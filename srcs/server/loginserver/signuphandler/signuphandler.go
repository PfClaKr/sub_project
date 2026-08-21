package signuphandler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"golang.org/x/crypto/bcrypt"

	"loginserver/verifyhandler"

	"local.com/jsonresponse"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/google/uuid"
)

type SignupRequest struct {
	Email           string `json:"email"`
	Password        string `json:"password"`
	UserNickname    string `json:"usernickname"`
	Residence       string `json:"residence"`
	ResidenceDetail string `json:"residencedetail,omitempty"`
	ProfileImage    string `json:"profileimage,omitempty"`
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

func SignupHandler(w http.ResponseWriter, r *http.Request) {
	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	userId := uuid.New().String()

	profileImage := req.ProfileImage
	if profileImage == "" {
		profileImage = defaultProfileImage
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
		return
	}
	hashedPassword := string(hashed)

	residence := req.Residence
	if residence == "" {
		residence = "파리"
	}

	usersItem := map[string]*dynamodb.AttributeValue{
		"UserId":            {S: aws.String(userId)},
		"Email":             {S: aws.String(req.Email)},
		"UserNickname":      {S: aws.String(req.UserNickname)},
		"Residence":         {S: aws.String(residence)},
		"ResidenceDetail":   {S: aws.String(req.ResidenceDetail)},
		"ProfileImage":      {S: aws.String(profileImage)},
		"ProductList":       {SS: []*string{aws.String("")}},
		"PublishedQuantity": {N: aws.String("0")},
		"CreatedAt":         {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
	}

	// bcrypt embeds its own salt in the hash; no separate Salt attribute.
	credentialsItem := map[string]*dynamodb.AttributeValue{
		"UserId":       {S: aws.String(userId)},
		"Email":        {S: aws.String(req.Email)},
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

	// Mail delivery failure must not roll back the account.
	if err := verifyhandler.Issue(req.Email); err != nil {
		jsonresponse.New(w, http.StatusOK, map[string]string{
			"message": "User created but verification mail failed",
		})
		return
	}

	jsonresponse.New(w, http.StatusOK, map[string]string{
		"message": "User signed in successfully",
		"next":    "verify-email",
	})
}
