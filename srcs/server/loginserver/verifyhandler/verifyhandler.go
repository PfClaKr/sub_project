package verifyhandler

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"local.com/dynamo"
	"local.com/i18n"
	"local.com/jsonresponse"
	"local.com/mailer"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

const tokenTTL = 24 * time.Hour

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

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
// Issue stores a new token and mails the link in lang.
func Issue(email, lang string) error {
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

	return sendVerification(email, token, lang)
}

// sendVerification mails the account activation link.
func sendVerification(to, token, lang string) error {
	link := fmt.Sprintf("%s/account/verify?token=%s", mailer.AppURL(), token)
	content := mailer.Content{
		Lang:      lang,
		Preheader: i18n.T(lang, "이메일 주소를 인증하면 가입이 끝나요."),
		Heading:   i18n.T(lang, "잇냥에 가입해주셔서 감사합니다!"),
		Intro:     []string{i18n.T(lang, "이메일 주소를 인증하면 가입이 끝나요.")},
		Button:    mailer.Link{Label: i18n.T(lang, "이메일 인증하기"), URL: link},
		Notes:     []string{i18n.T(lang, "본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.")},
	}
	return mailer.SendMessage(content.Message(to, i18n.T(lang, "[잇냥] 이메일 인증을 완료해주세요")))
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
	// VerifyTokenIndex (created by the apiserver) holds only rows with a
	// pending token.
	result, err := svc.Query(&dynamodb.QueryInput{
		TableName:              aws.String("UsersCredential"),
		IndexName:              aws.String("VerifyTokenIndex"),
		KeyConditionExpression: aws.String("VerifyToken = :t"),
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
	// Idempotent: opening the link twice (or React's double effect in
	// development) must not report a failure for a verified account.
	if IsVerified(email) {
		jsonresponse.New(w, http.StatusOK, map[string]string{"message": "email verified"})
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
		// The token is kept until a new one replaces it, so a second
		// click still resolves to this (now verified) account.
		UpdateExpression: aws.String("SET EmailVerified = :v"),
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
	// Same normalization as signup (strings.ToLower(TrimSpace)); the
	// signup package cannot be imported here (it imports this one).
	email := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("email")))
	if email == "" {
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "missing email"})
		return
	}
	if IsVerified(email) {
		jsonresponse.New(w, http.StatusOK, map[string]string{"message": "already verified"})
		return
	}
	if err := Issue(email, i18n.LangOf(r.Context())); err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "failed to send mail"})
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]string{"message": "verification mail sent"})
}
