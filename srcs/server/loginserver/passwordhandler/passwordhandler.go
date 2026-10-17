// Package passwordhandler lets members reset a forgotten password by
// mail and change it while logged in.
package passwordhandler

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"loginserver/ratelimit"
	"loginserver/signuphandler"

	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"
	"local.com/mailer"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

// TokenTTL is how long a reset link works. It is single use.
const TokenTTL = time.Hour

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

var (
	// Mails per address and requests per IP, so the form cannot be used
	// to flood someone's inbox.
	perEmail = ratelimit.New(3, time.Hour)
	perIP    = ratelimit.New(10, 15*time.Minute)
	// Wrong current passwords on the change form, per member.
	changeFailures = ratelimit.New(5, 15*time.Minute)
)

// ClientIP is set by main to the login handler's proxy-aware function.
var ClientIP = func(r *http.Request) string { return r.RemoteAddr }

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func newToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}

// ForgotHandler (POST /password/forgot {email}) mails a reset link when
// the address has an account. The answer is the same either way and the
// mail is sent in the background, so accounts cannot be discovered.
func ForgotHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	email := signuphandler.NormalizeEmail(req.Email)
	if email == "" || !strings.Contains(email, "@") {
		jsonresponse.Error(w, http.StatusBadRequest, "이메일 주소를 입력해주세요.")
		return
	}
	ip := ClientIP(r)
	if perIP.Blocked(ip) {
		jsonresponse.Error(w, http.StatusTooManyRequests, "요청이 너무 많아요. 잠시 후 다시 시도해주세요.")
		return
	}
	perIP.Fail(ip)

	if !perEmail.Blocked(email) {
		perEmail.Fail(email)
		go func() {
			if err := issue(email); err != nil {
				log.Printf("password reset for %s: %v", email, err)
			}
		}()
	}
	jsonresponse.New(w, http.StatusOK, map[string]string{"message": "sent"})
}

// issue stores the hash of a new token on the credential row (only if
// the account exists) and mails the link.
func issue(email string) error {
	token, err := newToken()
	if err != nil {
		return err
	}
	_, err = svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:           aws.String(dynamo.TableUsersCredential),
		Key:                 dynamo.Item{"Email": {S: aws.String(email)}},
		UpdateExpression:    aws.String("SET ResetTokenHash = :h, ResetExpires = :e"),
		ConditionExpression: aws.String("attribute_exists(Email)"),
		ExpressionAttributeValues: dynamo.Item{
			":h": {S: aws.String(hashToken(token))},
			":e": {N: aws.String(strconv.FormatInt(time.Now().Add(TokenTTL).Unix(), 10))},
		},
	})
	if isConditionFailed(err) {
		return nil // no account: nothing to send
	}
	if err != nil {
		return err
	}
	link := fmt.Sprintf("%s/account/reset?email=%s&token=%s", mailer.AppURL(), url.QueryEscape(email), token)
	body := fmt.Sprintf(
		"잇냥 비밀번호 재설정을 요청하셨어요.\n\n아래 링크에서 새 비밀번호를 정해주세요. 링크는 1시간 동안 한 번만 쓸 수 있어요.\n\n%s\n\n본인이 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 바뀌지 않아요.\n",
		link,
	)
	return mailer.Send(email, "[잇냥] 비밀번호 재설정", body)
}

var errBadLink = "링크가 만료되었거나 이미 사용되었어요. 비밀번호 찾기를 다시 요청해주세요."

// ResetHandler (POST /password/reset {email, token, password}) sets the
// new password if the token matches and has not expired, then logs the
// member in. The link proves the address, so the email counts as verified.
func ResetHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	if msg := signuphandler.ValidatePassword(req.Password); msg != "" {
		jsonresponse.Error(w, http.StatusBadRequest, msg)
		return
	}
	email := signuphandler.NormalizeEmail(req.Email)
	ip := ClientIP(r)
	if perIP.Blocked(ip) {
		jsonresponse.Error(w, http.StatusTooManyRequests, "요청이 너무 많아요. 잠시 후 다시 시도해주세요.")
		return
	}
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsersCredential),
		Key:                  dynamo.Item{"Email": {S: aws.String(email)}},
		ProjectionExpression: aws.String("UserId, ResetTokenHash, ResetExpires"),
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	stored := dynamo.S(out.Item, "ResetTokenHash")
	var expires int64
	if v := out.Item["ResetExpires"]; v != nil && v.N != nil {
		expires, _ = strconv.ParseInt(*v.N, 10, 64)
	}
	if stored == "" || req.Token == "" || subtle.ConstantTimeCompare([]byte(stored), []byte(hashToken(req.Token))) != 1 || time.Now().Unix() > expires {
		perIP.Fail(ip)
		jsonresponse.Error(w, http.StatusBadRequest, errBadLink)
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	// The condition makes the token single use even with two tabs.
	_, err = svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:           aws.String(dynamo.TableUsersCredential),
		Key:                 dynamo.Item{"Email": {S: aws.String(email)}},
		UpdateExpression:    aws.String("SET PasswordHash = :p, EmailVerified = :v, PasswordChangedAt = :now REMOVE ResetTokenHash, ResetExpires, Salt"),
		ConditionExpression: aws.String("ResetTokenHash = :h"),
		ExpressionAttributeValues: dynamo.Item{
			":p":   {S: aws.String(string(hashed))},
			":v":   {BOOL: aws.Bool(true)},
			":now": {N: aws.String(strconv.FormatInt(time.Now().Unix(), 10))},
			":h":   {S: aws.String(stored)},
		},
	})
	if isConditionFailed(err) {
		jsonresponse.Error(w, http.StatusBadRequest, errBadLink)
		return
	}
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	userId := dynamo.S(out.Item, "UserId")
	token, err := jwt.New(userId)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jwt.SetCookie(w, token)
	jsonresponse.New(w, http.StatusOK, map[string]string{"UserId": userId})
}

// ChangeHandler (POST /password/change {current, password}, logged in)
// replaces the password after checking the current one. Accounts made
// with Google have none; they set one through the reset mail.
func ChangeHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())
	var req struct {
		Current  string `json:"current"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	if msg := signuphandler.ValidatePassword(req.Password); msg != "" {
		jsonresponse.Error(w, http.StatusBadRequest, msg)
		return
	}
	if changeFailures.Blocked(userId) {
		jsonresponse.Error(w, http.StatusTooManyRequests, "시도가 너무 많아요. 잠시 후 다시 시도해주세요.")
		return
	}
	user, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsers),
		Key:                  dynamo.Item{"UserId": {S: aws.String(userId)}},
		ProjectionExpression: aws.String("Email"),
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	email := dynamo.S(user.Item, "Email")
	cred, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsersCredential),
		Key:                  dynamo.Item{"Email": {S: aws.String(email)}},
		ProjectionExpression: aws.String("UserId, PasswordHash"),
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if email == "" || dynamo.S(cred.Item, "UserId") != userId {
		jsonresponse.Error(w, http.StatusNotFound, "계정을 찾지 못했어요.")
		return
	}
	stored := dynamo.S(cred.Item, "PasswordHash")
	if stored == "" {
		jsonresponse.Error(w, http.StatusBadRequest, "Google로 가입한 계정이라 비밀번호가 없어요. 로그인 화면의 '비밀번호 찾기'로 만들 수 있어요.")
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(stored), []byte(req.Current)) != nil {
		changeFailures.Fail(userId)
		jsonresponse.Error(w, http.StatusBadRequest, "현재 비밀번호가 맞지 않아요.")
		return
	}
	changeFailures.Reset(userId)
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if _, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:        aws.String(dynamo.TableUsersCredential),
		Key:              dynamo.Item{"Email": {S: aws.String(email)}},
		UpdateExpression: aws.String("SET PasswordHash = :p, PasswordChangedAt = :now REMOVE ResetTokenHash, ResetExpires, Salt"),
		ExpressionAttributeValues: dynamo.Item{
			":p":   {S: aws.String(string(hashed))},
			":now": {N: aws.String(strconv.FormatInt(time.Now().Unix(), 10))},
		},
	}); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]string{"message": "changed"})
}

func isConditionFailed(err error) bool {
	aerr, ok := err.(awserr.Error)
	return ok && aerr.Code() == dynamodb.ErrCodeConditionalCheckFailedException
}
