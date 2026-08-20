package sessionhandler

import (
	"net/http"
	"os"
	"time"

	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

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

// WhoamiHandler returns the logged-in user's public profile.
// Must be wrapped with jwt.Middleware.
func WhoamiHandler(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value("claims").(*jwt.Claims)
	if !ok {
		jsonresponse.New(w, http.StatusUnauthorized, map[string]string{"error": "no session"})
		return
	}
	userId := claims.Username

	resp := map[string]string{"UserId": userId}
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String("Users"),
		Key: map[string]*dynamodb.AttributeValue{
			"UserId": {S: aws.String(userId)},
		},
		ProjectionExpression: aws.String("UserNickname, ProfileImage"),
	})
	if err == nil && result.Item != nil {
		if v := result.Item["UserNickname"]; v != nil && v.S != nil {
			resp["UserNickname"] = *v.S
		}
		if v := result.Item["ProfileImage"]; v != nil && v.S != nil {
			resp["ProfileImage"] = *v.S
		}
	}
	jsonresponse.New(w, http.StatusOK, resp)
}

// LogoutHandler clears the token cookie.
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
	})
	jsonresponse.New(w, http.StatusOK, map[string]string{"message": "logged out"})
}
