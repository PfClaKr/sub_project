package signuphandler

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"local.com/jsonresponse"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/google/uuid"
)

type SignupRequest struct {
	Email        string `json:"email"`
	Password     string `json:"password"`
	UserNickname string `json:"usernickname"`
	ProfileImage string `json:"profileimage,omitempty"`
}

const defaultProfileImage = "default_profile_image.png"

var svc dynamodbiface.DynamoDBAPI

func init() {
	sess := session.Must(session.NewSession(&aws.Config{
		Region:   aws.String(os.Getenv("AWS_REGION")),
		Endpoint: aws.String(os.Getenv("DYNAMODB_ENDPOINT")),
		Credentials: credentials.NewStaticCredentials(
			os.Getenv("AWS_ACCESS_KEY_ID"),
			os.Getenv("AWS_SECRET_ACCESS_KEY"),
			"",
		),
	}))
	svc = dynamodb.New(sess)
}

func generateSalt() (string, error) {
	salt := make([]byte, 16)
	_, err := rand.Read(salt)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(salt), nil
}

func hashPassword(password, salt string) string {
	hash := sha256.New()
	hash.Write([]byte(password + salt))
	return hex.EncodeToString(hash.Sum(nil))
}

func SignupHandler(w http.ResponseWriter, r *http.Request) {
	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		if r.Method == http.MethodOptions {
			jsonresponse.NewPreflight(w)
			return
		}
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	userId := uuid.New().String()

	profileImage := req.ProfileImage
	if profileImage == "" {
		profileImage = defaultProfileImage
	}

	salt, err := generateSalt()
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "Failed to generate salt"})
		return
	}
	hashedPassword := hashPassword(req.Password, salt)

	usersItem := map[string]*dynamodb.AttributeValue{
		"UserId":            {S: aws.String(userId)},
		"Email":             {S: aws.String(req.Email)},
		"UserNickname":      {S: aws.String(req.UserNickname)},
		"ProfileImage":      {S: aws.String(profileImage)},
		"ProductList":       {SS: []*string{aws.String("")}},
		"PublishedQuantity": {N: aws.String("0")},
		"CreatedAt":         {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
	}

	credentialsItem := map[string]*dynamodb.AttributeValue{
		"UserId":       {S: aws.String(userId)},
		"Email":        {S: aws.String(req.Email)},
		"Salt":         {S: aws.String(salt)},
		"PasswordHash": {S: aws.String(hashedPassword)},
	}

	usersTableName := "Users"
	if _, err := svc.PutItem(&dynamodb.PutItemInput{
		Item:      usersItem,
		TableName: aws.String(usersTableName),
	}); err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "Failed to save user"})
		return
	}

	credentialsTableName := "UsersCredential"
	if _, err := svc.PutItem(&dynamodb.PutItemInput{
		Item:      credentialsItem,
		TableName: aws.String(credentialsTableName),
	}); err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "Failed to save user credentials"})
		return
	}

	jsonresponse.New(w, http.StatusOK, map[string]string{"message": "User signed in successfully"})
}
