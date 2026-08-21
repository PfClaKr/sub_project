package loginhandler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"loginserver/verifyhandler"

	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
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

func getUserCredentialByEmail(email string) (string, string, string, error) {
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String("UsersCredential"),
		Key: map[string]*dynamodb.AttributeValue{
			"Email": {
				S: aws.String(email),
			},
		},
		ProjectionExpression: aws.String("UserId, PasswordHash, Salt"),
	})
	if err != nil {
		return "", "", "", err
	}

	if result.Item == nil {
		return "", "", "", fmt.Errorf("user not found")
	}

	var user struct {
		UserId   string `json:"UserId"`
		Password string `json:"PasswordHash"`
		Salt     string `json:"Salt"`
	}
	err = dynamodbattribute.UnmarshalMap(result.Item, &user)
	if err != nil {
		return "", "", "", err
	}

	return user.UserId, user.Password, user.Salt, nil
}

func hashPassword(password, salt string) string {
	hash := sha256.New()
	hash.Write([]byte(password + salt))
	return hex.EncodeToString(hash.Sum(nil))
}

// verifyPassword checks bcrypt hashes, falling back to the legacy
// sha256+salt scheme for accounts created before the bcrypt switch.
func verifyPassword(storedHash, salt, password string) bool {
	if strings.HasPrefix(storedHash, "$2") {
		return bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(password)) == nil
	}
	return storedHash == hashPassword(password, salt)
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	var loginRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&loginRequest); err != nil {
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "Invalid request payload"})
		return
	}

	userId, storedHash, salt, err := getUserCredentialByEmail(loginRequest.Email)
	if err != nil {
		jsonresponse.New(w, http.StatusUnauthorized, map[string]string{"error": fmt.Sprintf("Invalid email or password: %s", err)})
		return
	}

	if !verifyPassword(storedHash, salt, loginRequest.Password) {
		jsonresponse.New(w, http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
		return
	}

	if verifyhandler.Required() && !verifyhandler.IsVerified(loginRequest.Email) {
		jsonresponse.New(w, http.StatusForbidden, map[string]string{
			"error": "email not verified",
			"code":  "EMAIL_NOT_VERIFIED",
		})
		return
	}

	tokenString, err := jwt.New(userId)
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "Error generating token"})
		return
	}

	// Cookie lifetime follows the token lifetime.
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    tokenString,
		Path:     "/",
		Expires:  time.Now().Add(jwt.ExpireDuration()),
		HttpOnly: true,
		Secure:   false,
	})


	jsonresponse.New(w, http.StatusOK, map[string]string{"message": "JWT created"})
}
