package emailhandler

import (
	"net/http"

	"loginserver/signuphandler"

	"local.com/dynamo"
	"local.com/jsonresponse"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

// EmailcheckHandler answers GET /emailcheck?email=... with
// {"available": bool} so the signup form can warn early.
func EmailcheckHandler(w http.ResponseWriter, r *http.Request) {
	email := signuphandler.NormalizeEmail(r.URL.Query().Get("email"))
	if email == "" {
		jsonresponse.Error(w, http.StatusBadRequest, "email is required")
		return
	}

	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableUsersCredential),
		Key: dynamo.Item{
			"Email": {S: aws.String(email)},
		},
		ProjectionExpression: aws.String("Email"),
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"available": result.Item == nil})
}
