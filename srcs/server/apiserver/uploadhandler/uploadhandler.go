package uploadhandler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
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
	region := env("AWS_REGION", "eu-west-3")
	endpoint := os.Getenv("S3_ENDPOINT")

	cfg := &aws.Config{Region: aws.String(region)}
	if endpoint != "" {
		// S3-compatible storage (MinIO locally) needs path-style URLs.
		cfg.Endpoint = aws.String(endpoint)
		cfg.S3ForcePathStyle = aws.Bool(true)
	}
	// Explicit keys (MinIO); otherwise the default AWS chain: env
	// AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY or an instance role.
	if key := os.Getenv("S3_ACCESS_KEY"); key != "" {
		cfg.Credentials = credentials.NewStaticCredentials(key, os.Getenv("S3_SECRET_KEY"), "")
	}
	s3Client = s3.New(session.Must(session.NewSession(cfg)))

	switch {
	// A CDN (CloudFront) in front of the bucket serves objects at its
	// root: photos then go out through its free tier instead of S3's
	// (deploy/README.md).
	case os.Getenv("S3_CDN_URL") != "":
		publicBase = strings.TrimRight(os.Getenv("S3_CDN_URL"), "/")
	case os.Getenv("S3_PUBLIC_URL") != "":
		publicBase = os.Getenv("S3_PUBLIC_URL") + "/" + bucket
	case endpoint == "":
		publicBase = fmt.Sprintf("https://%s.s3.%s.amazonaws.com", bucket, region)
	default:
		publicBase = "http://localhost:9000/" + bucket
	}
}

// PublicBase is the URL prefix of uploaded images; product and profile
// image URLs must start with it.
func PublicBase() string {
	return publicBase
}

// EnsureBucket makes sure the bucket exists, retrying until the storage
// backend is reachable. A missing bucket is created with a public-read
// policy (MinIO); on AWS the bucket is prepared beforehand
// (deploy/aws-setup.sh), since new buckets block public policies.
func EnsureBucket() {
	for i := 0; i < 30; i++ {
		_, err := s3Client.HeadBucket(&s3.HeadBucketInput{Bucket: aws.String(bucket)})
		if err == nil {
			return
		}
		if aerr, ok := err.(awserr.RequestFailure); ok && aerr.StatusCode() == http.StatusNotFound {
			createPublicBucket()
			return
		}
		log.Printf("object storage not ready: %v. Retrying...", err)
		time.Sleep(2 * time.Second)
	}
	log.Fatal("object storage unreachable, giving up")
}

func createPublicBucket() {
	if _, err := s3Client.CreateBucket(&s3.CreateBucketInput{Bucket: aws.String(bucket)}); err != nil {
		if aerr, ok := err.(awserr.Error); !ok ||
			(aerr.Code() != s3.ErrCodeBucketAlreadyOwnedByYou && aerr.Code() != s3.ErrCodeBucketAlreadyExists) {
			log.Fatalf("create bucket %s: %v", bucket, err)
		}
	}
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
}

var allowedTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

// UploadHandler accepts multipart "image" files and returns their public
// URLs, plus the URLs of their thumbnails (process). Must be wrapped with
// jwt.Middleware.
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

	urls, thumbs := []string{}, []string{}
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
		if _, ok := allowedTypes[contentType]; !ok {
			http.Error(w, "only jpeg/png/gif/webp images are allowed", http.StatusBadRequest)
			return
		}
		img, err := process(data, contentType)
		if err != nil {
			http.Error(w, "unreadable or too large image", http.StatusBadRequest)
			return
		}

		id := uuid.NewString()
		if err := put(id+img.ext, img.data, img.contentType); err != nil {
			log.Printf("failed to store image: %v", err)
			http.Error(w, "failed to store image", http.StatusInternalServerError)
			return
		}
		if err := put(id+img.thumbExt, img.thumb, img.thumbType); err != nil {
			log.Printf("failed to store thumbnail: %v", err)
			http.Error(w, "failed to store image", http.StatusInternalServerError)
			return
		}
		urls = append(urls, publicBase+"/"+id+img.ext)
		thumbs = append(thumbs, publicBase+"/"+id+img.thumbExt)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string][]string{"urls": urls, "thumbs": thumbs})
}

func put(key string, data []byte, contentType string) error {
	_, err := s3Client.PutObject(&s3.PutObjectInput{
		Bucket:      aws.String(bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
		// Keys are random and never overwritten, so browsers can keep
		// images forever (fewer S3 GETs and transfer).
		CacheControl: aws.String("public, max-age=31536000, immutable"),
	})
	return err
}

// thumbKey is the thumbnail stored next to an uploaded image key.
func thumbKey(key string) string {
	dot := strings.LastIndex(key, ".")
	if dot < 0 || strings.Contains(key, "_t.") {
		return ""
	}
	if ext := key[dot:]; ext == ".png" || ext == ".gif" {
		return key[:dot] + "_t.png"
	}
	return key[:dot] + "_t.jpg"
}

// DeleteImages removes uploaded files by their public URLs, for content
// that is deleted (products, a leaving member's photos). URLs not served
// from this bucket (placeholders, Google avatars) are skipped. Best effort:
// failures are logged, the caller's deletion goes on.
func DeleteImages(urls ...string) {
	prefix := publicBase + "/"
	for _, u := range urls {
		key, ok := strings.CutPrefix(u, prefix)
		if !ok || key == "" {
			continue
		}
		// The thumbnail goes too (missing for images older than it).
		for _, k := range []string{key, thumbKey(key)} {
			if k == "" {
				continue
			}
			if _, err := s3Client.DeleteObject(&s3.DeleteObjectInput{Bucket: aws.String(bucket), Key: aws.String(k)}); err != nil {
				log.Printf("delete image %s: %v", k, err)
			}
		}
	}
}
