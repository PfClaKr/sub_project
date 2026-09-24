package loginhandler

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"net"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"loginserver/ratelimit"
	"loginserver/signuphandler"
	"loginserver/verifyhandler"

	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

// 10 failed logins per client IP per 15 minutes.
var limiter = ratelimit.New(10, 15*time.Minute)

type credential struct {
	Email        string
	UserId       string
	PasswordHash string
	Salt         string
}

// getCredential returns nil (no error) when the email is unknown.
func getCredential(email string) (*credential, error) {
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableUsersCredential),
		Key: dynamo.Item{
			"Email": {S: aws.String(email)},
		},
		ProjectionExpression: aws.String("UserId, PasswordHash, Salt"),
	})
	if err != nil || result.Item == nil {
		return nil, err
	}
	return &credential{
		Email:        email,
		UserId:       dynamo.S(result.Item, "UserId"),
		PasswordHash: dynamo.S(result.Item, "PasswordHash"),
		Salt:         dynamo.S(result.Item, "Salt"),
	}, nil
}

func legacyHash(password, salt string) string {
	hash := sha256.Sum256([]byte(password + salt))
	return hex.EncodeToString(hash[:])
}

// verifyPassword checks bcrypt hashes, falling back to the legacy
// sha256+salt scheme for accounts created before the bcrypt switch.
func verifyPassword(storedHash, salt, password string) bool {
	if strings.HasPrefix(storedHash, "$2") {
		return bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(password)) == nil
	}
	return subtle.ConstantTimeCompare([]byte(storedHash), []byte(legacyHash(password, salt))) == 1
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}

	ip := clientIP(r)
	if limiter.Blocked(ip) {
		jsonresponse.Error(w, http.StatusTooManyRequests, "로그인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.")
		return
	}

	cred, err := getCredential(signuphandler.NormalizeEmail(req.Email))
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	// Same message for unknown email and wrong password so accounts
	// cannot be enumerated.
	if cred == nil || !verifyPassword(cred.PasswordHash, cred.Salt, req.Password) {
		limiter.Fail(ip)
		jsonresponse.Error(w, http.StatusUnauthorized, "이메일 또는 비밀번호가 올바르지 않아요.")
		return
	}
	limiter.Reset(ip)

	if verifyhandler.Required() && !verifyhandler.IsVerified(cred.Email) {
		jsonresponse.New(w, http.StatusForbidden, map[string]string{
			"error": "이메일 인증을 완료해주세요. 메일함을 확인해주세요.",
			"code":  "EMAIL_NOT_VERIFIED",
		})
		return
	}

	token, err := jwt.New(cred.UserId)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jwt.SetCookie(w, token)
	jsonresponse.New(w, http.StatusOK, map[string]string{"UserId": cred.UserId})
}
