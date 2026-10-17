// Package account holds member state shared by every service. For now
// that is suspension: a suspended member can still log in and read, but
// every service refuses their writes (posts, comments, uploads, chat).
package account

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

const (
	StatusActive    = "active"
	StatusSuspended = "suspended"
)

// ErrSuspended is returned by CheckActive; SuspendedMessage is the text
// to show the member.
var ErrSuspended = errors.New("account suspended")

const SuspendedMessage = "이용이 정지된 계정이에요."

// State is the suspension part of a Users row. Until is in milliseconds;
// 0 means indefinitely.
type State struct {
	Status string
	Until  int64
}

// Suspended reports whether the state blocks writes at time now.
func (s State) Suspended(now time.Time) bool {
	if s.Status != StatusSuspended {
		return false
	}
	return s.Until == 0 || now.UnixMilli() < s.Until
}

// StateOf reads the state from a Users item (e.g. one fetched for
// another reason, to avoid a second read).
func StateOf(item dynamo.Item) State {
	st := State{Status: dynamo.S(item, "Status")}
	if v := item["SuspendedUntil"]; v != nil && v.N != nil {
		st.Until, _ = strconv.ParseInt(*v.N, 10, 64)
	}
	if st.Status == "" {
		st.Status = StatusActive
	}
	return st
}

// Get reads a member's state.
func Get(svc dynamodbiface.DynamoDBAPI, userId string) (State, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsers),
		Key:                  dynamo.Item{"UserId": {S: aws.String(userId)}},
		ProjectionExpression: aws.String("#s, SuspendedUntil"),
		// STATUS is a DynamoDB reserved word.
		ExpressionAttributeNames: map[string]*string{"#s": aws.String("Status")},
	})
	if err != nil {
		return State{}, err
	}
	return StateOf(out.Item), nil
}

// CheckActive returns ErrSuspended for a suspended member. Call it before
// any write made on a member's behalf.
func CheckActive(svc dynamodbiface.DynamoDBAPI, userId string) error {
	st, err := Get(svc, userId)
	if err != nil {
		return err
	}
	if st.Suspended(time.Now()) {
		return ErrSuspended
	}
	return nil
}

// Suspend blocks a member until the given time (zero time: indefinitely).
func Suspend(svc dynamodbiface.DynamoDBAPI, userId string, until time.Time) error {
	var ms int64
	if !until.IsZero() {
		ms = until.UnixMilli()
	}
	_, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                aws.String(dynamo.TableUsers),
		Key:                      dynamo.Item{"UserId": {S: aws.String(userId)}},
		UpdateExpression:         aws.String("SET #s = :s, SuspendedUntil = :u"),
		ConditionExpression:      aws.String("attribute_exists(UserId)"),
		ExpressionAttributeNames: map[string]*string{"#s": aws.String("Status")},
		ExpressionAttributeValues: dynamo.Item{
			":s": {S: aws.String(StatusSuspended)},
			":u": {N: aws.String(strconv.FormatInt(ms, 10))},
		},
	})
	return err
}

// Reinstate lifts a suspension.
func Reinstate(svc dynamodbiface.DynamoDBAPI, userId string) error {
	_, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TableUsers),
		Key:                       dynamo.Item{"UserId": {S: aws.String(userId)}},
		UpdateExpression:          aws.String("SET #s = :s REMOVE SuspendedUntil"),
		ConditionExpression:       aws.String("attribute_exists(UserId)"),
		ExpressionAttributeNames:  map[string]*string{"#s": aws.String("Status")},
		ExpressionAttributeValues: dynamo.Item{":s": {S: aws.String(StatusActive)}},
	})
	return err
}

// RequireActive answers 403 for suspended members. Wrap it inside
// jwt.Middleware so the user id is in the context.
func RequireActive(svc dynamodbiface.DynamoDBAPI, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch err := CheckActive(svc, jwt.UserID(r.Context())); {
		case errors.Is(err, ErrSuspended):
			jsonresponse.Error(w, http.StatusForbidden, SuspendedMessage)
		case err != nil:
			jsonresponse.Internal(w, err)
		default:
			next.ServeHTTP(w, r)
		}
	})
}
