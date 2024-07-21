package emailhandler

import (
	"encoding/json"
	"net/http"
	"os"

	"local.com/jsonresponse"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

type EmailRequest struct {
	Email string `json:"email"`
}

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

func checkUserByEmail(email string) bool {
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String("UsersCredential"),
		Key: map[string]*dynamodb.AttributeValue{
			"Email": {
				S: aws.String(email),
			},
		},
	})
	if err != nil {
		return true
	}
	if result.Item == nil {
		return true
	}
	return false
}

func EmailcheckHandler(w http.ResponseWriter, r *http.Request) {
	var req EmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if checkUserByEmail(req.Email) {
		jsonresponse.New(w, http.StatusOK, map[string]string{"message": "can use email"})
		return
	}
	jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "already used email"})
}
