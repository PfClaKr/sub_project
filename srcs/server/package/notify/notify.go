// Package notify records notifications for members and hands them to
// delivery channels. Every service publishes through it: apiserver for
// comments, answers and expiring posts, chatserver for messages, admin
// actions for moderation results.
//
// A notification is always stored in the Notifications table (the in-app
// list, kept 90 days through DynamoDB TTL) and bumps Users.UnreadCount so
// the header badge costs one GetItem. Channels (email now, web push later)
// pick notifications up by EmailState; see Channel.
package notify

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

// Table is keyed by UserId + SortKey ("<ms>#<random>", newest last).
const Table = "Notifications"

// Retention is how long notifications stay in the list.
const Retention = 90 * 24 * time.Hour

// Event types.
const (
	TypeComment  = "comment"  // a comment on my post
	TypeReply    = "reply"    // a reply to my comment
	TypeAccepted = "accepted" // my answer was accepted
	TypeExpiring = "expiring" // my housing/job post expires soon
	TypeHidden   = "hidden"   // my post or comment was hidden after reports
	TypeRestored = "restored" // ...and restored by an admin
	TypeChat     = "chat"     // a chat message while I was away
	TypeNotice   = "notice"   // announcement from the admins
)

// Email modes per event type.
const (
	EmailImmediate = "immediate"
	EmailDigest    = "digest"
	EmailOff       = "off"
)

// DefaultEmail is the email mode for members who have not changed their
// notification settings.
var DefaultEmail = map[string]string{
	TypeComment:  EmailDigest,
	TypeReply:    EmailDigest,
	TypeAccepted: EmailImmediate,
	TypeExpiring: EmailImmediate,
	TypeHidden:   EmailImmediate,
	TypeRestored: EmailImmediate,
	TypeChat:     EmailDigest,
	TypeNotice:   EmailOff,
}

// EmailState values: "pending" waits for the email channel, "none" means
// no mail for this one, "sent" is done.
const (
	EmailPending = "pending"
	EmailNone    = "none"
	EmailSent    = "sent"
)

// Event is what a service publishes. UserId is the recipient.
type Event struct {
	UserId     string
	Type       string
	ActorId    string // who caused it; never notified about their own action
	TargetType string // "post", "comment", "chat", ...
	TargetId   string
	Preview    string // short text shown in the list, e.g. the comment start
	Link       string // site path to open, e.g. "/community/<id>"
}

type Notification struct {
	UserId     string `json:"UserId"`
	SortKey    string `json:"SortKey"`
	Type       string `json:"Type"`
	ActorId    string `json:"ActorId"`
	TargetType string `json:"TargetType"`
	TargetId   string `json:"TargetId"`
	Preview    string `json:"Preview"`
	Link       string `json:"Link"`
	Read       bool   `json:"Read"`
	CreatedAt  int64  `json:"CreatedAt"` // ms
	EmailMode  string `json:"EmailMode"`
	EmailState string `json:"EmailState"`
	ExpiresAt  int64  `json:"ExpiresAt"` // seconds, DynamoDB TTL attribute
}

// Channel delivers stored notifications outside the site. The email
// channel batches EmailState=pending rows (immediately or as a digest);
// a web push channel will implement the same interface.
type Channel interface {
	Name() string
	Deliver(userId string, ns []Notification) error
}

// Notifier stores notifications. Zero value is not usable; use New.
type Notifier struct {
	svc dynamodbiface.DynamoDBAPI
	now func() time.Time
}

func New(svc dynamodbiface.DynamoDBAPI) *Notifier {
	return &Notifier{svc: svc, now: time.Now}
}

const previewMax = 80

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func randomSuffix() string {
	b := make([]byte, 6)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// Publish stores the event for its recipient. Events about one's own
// actions and events without a recipient are dropped.
func (n *Notifier) Publish(ev Event) error {
	if ev.UserId == "" || ev.UserId == ev.ActorId {
		return nil
	}
	now := n.now()
	mode := DefaultEmail[ev.Type]
	if mode == "" {
		mode = EmailOff
	}
	state := EmailPending
	if mode == EmailOff {
		state = EmailNone
	}
	item, err := dynamodbattribute.MarshalMap(Notification{
		UserId:     ev.UserId,
		SortKey:    fmt.Sprintf("%013d#%s", now.UnixMilli(), randomSuffix()),
		Type:       ev.Type,
		ActorId:    ev.ActorId,
		TargetType: ev.TargetType,
		TargetId:   ev.TargetId,
		Preview:    truncate(ev.Preview, previewMax),
		Link:       ev.Link,
		CreatedAt:  now.UnixMilli(),
		EmailMode:  mode,
		EmailState: state,
		ExpiresAt:  now.Add(Retention).Unix(),
	})
	if err != nil {
		return err
	}
	if _, err := n.svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(Table), Item: item}); err != nil {
		return err
	}
	return n.addUnread(ev.UserId, 1)
}

// addUnread moves the badge counter; the condition keeps a deleted
// member's id from creating a stray Users row.
func (n *Notifier) addUnread(userId string, delta int) error {
	_, err := n.svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TableUsers),
		Key:                       dynamo.Item{"UserId": {S: aws.String(userId)}},
		UpdateExpression:          aws.String("ADD UnreadCount :d"),
		ConditionExpression:       aws.String("attribute_exists(UserId)"),
		ExpressionAttributeValues: dynamo.Item{":d": {N: aws.String(strconv.Itoa(delta))}},
	})
	if aerr, ok := err.(awserr.Error); ok && aerr.Code() == dynamodb.ErrCodeConditionalCheckFailedException {
		return nil
	}
	return err
}

// PageSize is the number of notifications per List call.
const PageSize = 30

// List returns a member's notifications, newest first. before is the
// SortKey to continue after ("" for the first page); next is "" on the
// last page.
func (n *Notifier) List(userId, before string) (items []Notification, next string, err error) {
	in := &dynamodb.QueryInput{
		TableName:                 aws.String(Table),
		KeyConditionExpression:    aws.String("UserId = :u"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(userId)}},
		ScanIndexForward:          aws.Bool(false),
		Limit:                     aws.Int64(PageSize),
	}
	if before != "" {
		in.ExclusiveStartKey = dynamo.Item{
			"UserId":  {S: aws.String(userId)},
			"SortKey": {S: aws.String(before)},
		}
	}
	out, err := n.svc.Query(in)
	if err != nil {
		return nil, "", err
	}
	items = []Notification{}
	if err := dynamodbattribute.UnmarshalListOfMaps(out.Items, &items); err != nil {
		return nil, "", err
	}
	if out.LastEvaluatedKey != nil {
		next = dynamo.S(out.LastEvaluatedKey, "SortKey")
	}
	return items, next, nil
}

// UnreadCount is the header badge number.
func (n *Notifier) UnreadCount(userId string) (int, error) {
	out, err := n.svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsers),
		Key:                  dynamo.Item{"UserId": {S: aws.String(userId)}},
		ProjectionExpression: aws.String("UnreadCount"),
	})
	if err != nil {
		return 0, err
	}
	var count int
	if v := out.Item["UnreadCount"]; v != nil && v.N != nil {
		count, _ = strconv.Atoi(*v.N)
	}
	if count < 0 {
		count = 0
	}
	return count, nil
}

// MarkRead marks the given notifications read and returns how many
// changed. With no keys it marks everything read and resets the counter,
// which also repairs any drift.
func (n *Notifier) MarkRead(userId string, sortKeys []string) (int, error) {
	if len(sortKeys) == 0 {
		return n.markAllRead(userId)
	}
	changed := 0
	for _, key := range sortKeys {
		ok, err := n.markOne(userId, key)
		if err != nil {
			return changed, err
		}
		if ok {
			changed++
		}
	}
	if changed > 0 {
		if err := n.addUnread(userId, -changed); err != nil {
			return changed, err
		}
	}
	return changed, nil
}

// markOne flips Read; false when it was already read or does not exist.
func (n *Notifier) markOne(userId, sortKey string) (bool, error) {
	_, err := n.svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName: aws.String(Table),
		Key: dynamo.Item{
			"UserId":  {S: aws.String(userId)},
			"SortKey": {S: aws.String(sortKey)},
		},
		UpdateExpression:          aws.String("SET #rd = :t"),
		ConditionExpression:       aws.String("attribute_exists(SortKey) AND #rd = :f"),
		ExpressionAttributeNames:  map[string]*string{"#rd": aws.String("Read")},
		ExpressionAttributeValues: dynamo.Item{":t": {BOOL: aws.Bool(true)}, ":f": {BOOL: aws.Bool(false)}},
	})
	if aerr, ok := err.(awserr.Error); ok && aerr.Code() == dynamodb.ErrCodeConditionalCheckFailedException {
		return false, nil
	}
	return err == nil, err
}

func (n *Notifier) markAllRead(userId string) (int, error) {
	items, err := dynamo.QueryAll(n.svc, &dynamodb.QueryInput{
		TableName:                 aws.String(Table),
		KeyConditionExpression:    aws.String("UserId = :u"),
		FilterExpression:          aws.String("#rd = :f"),
		ProjectionExpression:      aws.String("SortKey"),
		ExpressionAttributeNames:  map[string]*string{"#rd": aws.String("Read")},
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(userId)}, ":f": {BOOL: aws.Bool(false)}},
	})
	if err != nil {
		return 0, err
	}
	changed := 0
	for _, it := range items {
		ok, err := n.markOne(userId, dynamo.S(it, "SortKey"))
		if err != nil {
			return changed, err
		}
		if ok {
			changed++
		}
	}
	_, err = n.svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TableUsers),
		Key:                       dynamo.Item{"UserId": {S: aws.String(userId)}},
		UpdateExpression:          aws.String("SET UnreadCount = :z"),
		ConditionExpression:       aws.String("attribute_exists(UserId)"),
		ExpressionAttributeValues: dynamo.Item{":z": {N: aws.String("0")}},
	})
	if aerr, ok := err.(awserr.Error); ok && aerr.Code() == dynamodb.ErrCodeConditionalCheckFailedException {
		err = nil
	}
	return changed, err
}
