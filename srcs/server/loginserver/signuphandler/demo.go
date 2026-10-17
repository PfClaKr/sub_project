package signuphandler

import (
	"errors"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

// EnsureDemoAccount creates a verified account for `make demo`, or resets
// the password and profile of an existing one, so it can be run again.
// The account is backdated by ageDays: housing/job posts need an account
// older than LISTING_MIN_ACCOUNT_DAYS. Runs only from the CLI
// (/main demo-account), never over HTTP.
func EnsureDemoAccount(req SignupRequest, ageDays int) (string, error) {
	if msg := req.Validate(); msg != "" {
		return "", errors.New(msg)
	}
	userId, err := createAccount(req)
	if errors.Is(err, errEmailTaken) {
		userId, err = existingUserId(req.Email)
	}
	if err != nil {
		return "", err
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	if _, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:        aws.String(dynamo.TableUsersCredential),
		Key:              dynamo.Item{"Email": {S: aws.String(req.Email)}},
		UpdateExpression: aws.String("SET PasswordHash = :h, EmailVerified = :v REMOVE VerifyToken, VerifyExpires"),
		ExpressionAttributeValues: dynamo.Item{
			":h": {S: aws.String(string(hashed))},
			":v": {BOOL: aws.Bool(true)},
		},
	}); err != nil {
		return "", err
	}
	created := time.Now().AddDate(0, 0, -ageDays).Unix()
	_, err = svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:        aws.String(dynamo.TableUsers),
		Key:              dynamo.Item{"UserId": {S: aws.String(userId)}},
		UpdateExpression: aws.String("SET Email = :e, UserNickname = :n, Residence = :r, CreatedAt = :c"),
		ExpressionAttributeValues: dynamo.Item{
			":e": {S: aws.String(req.Email)},
			":n": {S: aws.String(req.UserNickname)},
			":r": {S: aws.String(req.Residence)},
			":c": {N: aws.String(fmt.Sprintf("%d", created))},
		},
	})
	return userId, err
}

func existingUserId(email string) (string, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsersCredential),
		Key:                  dynamo.Item{"Email": {S: aws.String(email)}},
		ProjectionExpression: aws.String("UserId"),
	})
	if err != nil {
		return "", err
	}
	if id := dynamo.S(out.Item, "UserId"); id != "" {
		return id, nil
	}
	return "", fmt.Errorf("no credential row for %s", email)
}
