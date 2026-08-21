package verifyhandler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"time"

	"loginserver/mailer"

	"local.com/jsonresponse"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

const tokenTTL = 24 * time.Hour

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

// Required reports whether unverified accounts are blocked from logging in.
func Required() bool {
	return os.Getenv("REQUIRE_EMAIL_VERIFICATION") != "false"
}

func newToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// Issue stores a fresh verification token on the credential row and
// mails the activation link.
func Issue(email string) error {
	token, err := newToken()
	if err != nil {
		return err
	}
	expires := time.Now().Add(tokenTTL).Unix()

	if _, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName: aws.String("UsersCredential"),
		Key: map[string]*dynamodb.AttributeValue{
			"Email": {S: aws.String(email)},
		},
		UpdateExpression: aws.String("SET VerifyToken = :t, VerifyExpires = :e, EmailVerified = :v"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":t": {S: aws.String(token)},
			":e": {N: aws.String(fmt.Sprintf("%d", expires))},
			":v": {BOOL: aws.Bool(false)},
		},
	}); err != nil {
		return err
	}

	return mailer.SendVerification(email, token)
}

// IsVerified reports whether the credential row is activated.
// Rows predating this feature have no flag and are treated as verified.
func IsVerified(email string) bool {
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String("UsersCredential"),
		Key: map[string]*dynamodb.AttributeValue{
			"Email": {S: aws.String(email)},
		},
		ProjectionExpression: aws.String("EmailVerified"),
	})
	if err != nil || result.Item == nil {
		return false
	}
	flag, ok := result.Item["EmailVerified"]
	if !ok || flag.BOOL == nil {
		return true
	}
	return *flag.BOOL
}

func findEmailByToken(token string) (string, int64, bool) {
	// MVP: scan by token; replace with a GSI after cloud migration.
	result, err := svc.Scan(&dynamodb.ScanInput{
		TableName:        aws.String("UsersCredential"),
		FilterExpression: aws.String("VerifyToken = :t"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":t": {S: aws.String(token)},
		},
		ProjectionExpression: aws.String("Email, VerifyExpires"),
	})
	if err != nil || len(result.Items) == 0 {
		return "", 0, false
	}
	item := result.Items[0]
	if item["Email"] == nil || item["Email"].S == nil {
		return "", 0, false
	}
	var expires int64
	if v := item["VerifyExpires"]; v != nil && v.N != nil {
		fmt.Sscanf(*v.N, "%d", &expires)
	}
	return *item["Email"].S, expires, true
}

// VerifyHandler activates the account tied to the token.
func VerifyHandler(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "missing token"})
		return
	}

	email, expires, ok := findEmailByToken(token)
	if !ok {
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "invalid or already used token"})
		return
	}
	if expires > 0 && time.Now().Unix() > expires {
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "token expired"})
		return
	}

	if _, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName: aws.String("UsersCredential"),
		Key: map[string]*dynamodb.AttributeValue{
			"Email": {S: aws.String(email)},
		},
		UpdateExpression: aws.String("SET EmailVerified = :v REMOVE VerifyToken, VerifyExpires"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":v": {BOOL: aws.Bool(true)},
		},
	}); err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "failed to verify"})
		return
	}

	jsonresponse.New(w, http.StatusOK, map[string]string{"message": "email verified"})
}

// ResendHandler issues a new token for an unverified account.
func ResendHandler(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "missing email"})
		return
	}
	if IsVerified(email) {
		jsonresponse.New(w, http.StatusOK, map[string]string{"message": "already verified"})
		return
	}
	if err := Issue(email); err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "failed to send mail"})
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]string{"message": "verification mail sent"})
}
