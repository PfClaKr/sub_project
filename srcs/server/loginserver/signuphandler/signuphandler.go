package signuphandler

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/mail"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"

	"loginserver/verifyhandler"

	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
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
}

// DefaultResidence is used when the form leaves it empty.
const DefaultResidence = "파리"

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

// NormalizeEmail is shared with login so both look up the same key.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// Validate normalizes the request in place and returns a user-facing
// error message, or "" when valid.
func (req *SignupRequest) Validate() string {
	req.Email = NormalizeEmail(req.Email)
	req.UserNickname = strings.TrimSpace(req.UserNickname)

	if addr, err := mail.ParseAddress(req.Email); err != nil || addr.Address != req.Email {
		return "올바른 이메일 주소를 입력해주세요."
	}
	// bcrypt ignores bytes past 72.
	if len(req.Password) < 8 || len(req.Password) > 72 {
		return "비밀번호는 8자 이상 72바이트 이하여야 해요."
	}
	if n := utf8.RuneCountInString(req.UserNickname); n < 2 || n > 20 {
		return "닉네임은 2~20자로 입력해주세요."
	}
	req.Residence = strings.TrimSpace(req.Residence)
	if req.Residence == "" {
		req.Residence = DefaultResidence
	}
	req.ResidenceDetail = strings.TrimSpace(req.ResidenceDetail)
	if utf8.RuneCountInString(req.Residence) > 30 || utf8.RuneCountInString(req.ResidenceDetail) > 100 {
		return "거주지를 확인해주세요."
	}
	return ""
}

var errEmailTaken = errors.New("email already used")

// createAccount writes Users and UsersCredential atomically; the
// condition on Email prevents overwriting an existing account.
func createAccount(req SignupRequest) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	userId := uuid.NewString()

	_, err = svc.TransactWriteItems(&dynamodb.TransactWriteItemsInput{
		TransactItems: []*dynamodb.TransactWriteItem{
			{Put: &dynamodb.Put{
				TableName: aws.String(dynamo.TableUsersCredential),
				Item: dynamo.Item{
					"Email":         {S: aws.String(req.Email)},
					"UserId":        {S: aws.String(userId)},
					"PasswordHash":  {S: aws.String(string(hashed))},
					"EmailVerified": {BOOL: aws.Bool(!verifyhandler.Required())},
				},
				ConditionExpression: aws.String("attribute_not_exists(Email)"),
			}},
			{Put: &dynamodb.Put{
				TableName: aws.String(dynamo.TableUsers),
				Item: dynamo.Item{
					"UserId":            {S: aws.String(userId)},
					"Email":             {S: aws.String(req.Email)},
					"UserNickname":      {S: aws.String(req.UserNickname)},
					"Residence":         {S: aws.String(req.Residence)},
					"ResidenceDetail":   {S: aws.String(req.ResidenceDetail)},
					"PublishedQuantity": {N: aws.String("0")},
					"CreatedAt":         {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
				},
				ConditionExpression: aws.String("attribute_not_exists(UserId)"),
			}},
		},
	})
	if aerr, ok := err.(awserr.Error); ok && aerr.Code() == dynamodb.ErrCodeTransactionCanceledException {
		return "", errEmailTaken
	}
	return userId, err
}

// SignupHandler creates the account. With email verification required
// (the default) it mails the activation link and the user logs in after
// verifying; otherwise the new user is logged in right away.
func SignupHandler(w http.ResponseWriter, r *http.Request) {
	var req SignupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	if msg := req.Validate(); msg != "" {
		jsonresponse.Error(w, http.StatusBadRequest, msg)
		return
	}

	userId, err := createAccount(req)
	if errors.Is(err, errEmailTaken) {
		jsonresponse.Error(w, http.StatusConflict, "이미 사용 중인 이메일이에요.")
		return
	}
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}

	resp := map[string]string{"UserId": userId, "UserNickname": req.UserNickname}
	if verifyhandler.Required() {
		// Mail delivery failure must not roll back the account; the user
		// can ask for a new link from the login page.
		if err := verifyhandler.Issue(req.Email); err != nil {
			log.Printf("signup: verification mail to %s failed: %v", req.Email, err)
			resp["mail"] = "failed"
		}
		resp["next"] = "verify-email"
		jsonresponse.New(w, http.StatusCreated, resp)
		return
	}

	token, err := jwt.New(userId)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jwt.SetCookie(w, token)
	jsonresponse.New(w, http.StatusCreated, resp)
}
