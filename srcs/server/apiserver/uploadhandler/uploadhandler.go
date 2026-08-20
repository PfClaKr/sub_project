package uploadhandler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/google/uuid"
)

const maxUploadSize = 5 << 20 // 5MB per file
const maxFiles = 5

var s3Client *s3.S3
var bucket string
var publicBase string

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func init() {
	bucket = env("S3_BUCKET", "product-images")
	publicBase = env("S3_PUBLIC_URL", "http://localhost:9000") + "/" + bucket

	sess := session.Must(session.NewSession(&aws.Config{
		Region:   aws.String(env("AWS_REGION", "eu-west-3")),
		Endpoint: aws.String(env("S3_ENDPOINT", "http://minio:9000")),
		Credentials: credentials.NewStaticCredentials(
			env("S3_ACCESS_KEY", "minioadmin"),
			env("S3_SECRET_KEY", "minioadmin"),
			"",
		),
		// Path-style is required by MinIO; harmless on real S3.
		S3ForcePathStyle: aws.Bool(true),
	}))
	s3Client = s3.New(sess)
}

// EnsureBucket creates the bucket with public-read policy, retrying
// until the storage backend is reachable.
func EnsureBucket() {
	for i := 0; i < 30; i++ {
		_, err := s3Client.CreateBucket(&s3.CreateBucketInput{
			Bucket: aws.String(bucket),
		})
		if err != nil {
			if aerr, ok := err.(awserr.Error); ok &&
				(aerr.Code() == s3.ErrCodeBucketAlreadyOwnedByYou || aerr.Code() == s3.ErrCodeBucketAlreadyExists) {
				err = nil
			}
		}
		if err == nil {
			policy := fmt.Sprintf(`{
				"Version": "2012-10-17",
				"Statement": [{
					"Effect": "Allow",
					"Principal": {"AWS": ["*"]},
					"Action": ["s3:GetObject"],
					"Resource": ["arn:aws:s3:::%s/*"]
				}]
			}`, bucket)
			if _, err := s3Client.PutBucketPolicy(&s3.PutBucketPolicyInput{
				Bucket: aws.String(bucket),
				Policy: aws.String(policy),
			}); err != nil {
				log.Printf("failed to set bucket policy: %v", err)
			}
			return
		}
		log.Printf("object storage not ready: %v. Retrying...", err)
		time.Sleep(2 * time.Second)
	}
	log.Fatal("object storage unreachable, giving up")
}

var allowedTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

// UploadHandler accepts multipart "image" files and returns public URLs.
// Must be wrapped with jwt.Middleware.
func UploadHandler(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize*maxFiles)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		http.Error(w, "invalid multipart form or file too large", http.StatusBadRequest)
		return
	}

	files := r.MultipartForm.File["image"]
	if len(files) == 0 || len(files) > maxFiles {
		http.Error(w, fmt.Sprintf("expected 1-%d image files", maxFiles), http.StatusBadRequest)
		return
	}

	urls := []string{}
	for _, fh := range files {
		f, err := fh.Open()
		if err != nil {
			http.Error(w, "failed to read file", http.StatusBadRequest)
			return
		}
		data, err := io.ReadAll(io.LimitReader(f, maxUploadSize+1))
		f.Close()
		if err != nil || len(data) > maxUploadSize {
			http.Error(w, "file too large", http.StatusBadRequest)
			return
		}

		contentType := http.DetectContentType(data)
		ext, ok := allowedTypes[contentType]
		if !ok {
			http.Error(w, "only jpeg/png/gif/webp images are allowed", http.StatusBadRequest)
			return
		}

		key := uuid.NewString() + ext
		if _, err := s3Client.PutObject(&s3.PutObjectInput{
			Bucket:      aws.String(bucket),
			Key:         aws.String(key),
			Body:        bytes.NewReader(data),
			ContentType: aws.String(contentType),
		}); err != nil {
			log.Printf("failed to store image: %v", err)
			http.Error(w, "failed to store image", http.StatusInternalServerError)
			return
		}
		urls = append(urls, publicBase+"/"+key)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]string{"urls": urls})
}
