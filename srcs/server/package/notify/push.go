package notify

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"local.com/dynamo"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

// Web push (VAPID). Browsers give a subscription (an endpoint at their
// push service plus keys); it is stored per member and device in
// PushSubscriptions (UserId + EndpointHash). Publish sends every
// notification the member wants pushed to all their devices; endpoints
// the push service reports gone (404/410) are deleted.
//
// Keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (generate them once
// with `/main vapid-keys` in the apiserver); VAPID_SUBJECT is a contact
// URL or mailto: for the push services.

const PushTable = "PushSubscriptions"

// PushConfigured reports whether VAPID keys are set.
func PushConfigured() bool {
	return os.Getenv("VAPID_PUBLIC_KEY") != "" && os.Getenv("VAPID_PRIVATE_KEY") != ""
}

// PublicKey is the application server key the browser subscribes with.
func PublicKey() string { return os.Getenv("VAPID_PUBLIC_KEY") }

// GenerateVAPIDKeys makes a new key pair (base64url).
func GenerateVAPIDKeys() (private, public string, err error) {
	return webpush.GenerateVAPIDKeys()
}

// Subscription is what PushManager.subscribe() returns (toJSON()).
type Subscription struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

var ErrBadSubscription = errors.New("push subscription is invalid")

func endpointHash(endpoint string) string {
	sum := sha256.Sum256([]byte(endpoint))
	return hex.EncodeToString(sum[:16])
}

// SaveSubscription stores a device for a member (replacing the same
// endpoint).
func SaveSubscription(svc dynamodbiface.DynamoDBAPI, userId string, s Subscription) error {
	u, err := url.Parse(s.Endpoint)
	if err != nil || u.Scheme != "https" || u.Host == "" || len(s.Endpoint) > 1000 ||
		s.Keys.P256dh == "" || s.Keys.Auth == "" || len(s.Keys.P256dh) > 200 || len(s.Keys.Auth) > 100 {
		return ErrBadSubscription
	}
	_, err = svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String(PushTable),
		Item: dynamo.Item{
			"UserId":       {S: aws.String(userId)},
			"EndpointHash": {S: aws.String(endpointHash(s.Endpoint))},
			"Endpoint":     {S: aws.String(s.Endpoint)},
			"P256dh":       {S: aws.String(s.Keys.P256dh)},
			"Auth":         {S: aws.String(s.Keys.Auth)},
			"CreatedAt":    {N: aws.String(strconv.FormatInt(time.Now().UnixMilli(), 10))},
		},
	})
	return err
}

// DeleteSubscription removes one device of a member.
func DeleteSubscription(svc dynamodbiface.DynamoDBAPI, userId, endpoint string) error {
	_, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
		TableName: aws.String(PushTable),
		Key:       dynamo.Item{"UserId": {S: aws.String(userId)}, "EndpointHash": {S: aws.String(endpointHash(endpoint))}},
	})
	return err
}

// pushPayload is what public/sw.js shows.
type pushPayload struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url"`
	Tag   string `json:"tag"`
}

func payloadFor(n Notification) []byte {
	link := n.Link
	if !strings.HasPrefix(link, "/") {
		link = "/notifications"
	}
	b, _ := json.Marshal(pushPayload{Title: Title(n.Type), Body: n.Preview, URL: link, Tag: n.Type + ":" + n.TargetId})
	return b
}

// sendPush is swapped in tests.
var sendPush = func(payload []byte, s *webpush.Subscription, o *webpush.Options) (*http.Response, error) {
	return webpush.SendNotification(payload, s, o)
}

// deliverPush sends one notification to every device of a member.
func (n *Notifier) deliverPush(userId string, notif Notification) {
	subs, err := dynamo.QueryAll(n.svc, &dynamodb.QueryInput{
		TableName:                 aws.String(PushTable),
		KeyConditionExpression:    aws.String("UserId = :u"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(userId)}},
	})
	if err != nil {
		log.Printf("push subscriptions of %s: %v", userId, err)
		return
	}
	subject := os.Getenv("VAPID_SUBJECT")
	if subject == "" {
		subject = "mailto:no-reply@itnyang.local"
	}
	payload := payloadFor(notif)
	for _, s := range subs {
		res, err := sendPush(payload, &webpush.Subscription{
			Endpoint: dynamo.S(s, "Endpoint"),
			Keys:     webpush.Keys{P256dh: dynamo.S(s, "P256dh"), Auth: dynamo.S(s, "Auth")},
		}, &webpush.Options{
			Subscriber:      subject,
			VAPIDPublicKey:  os.Getenv("VAPID_PUBLIC_KEY"),
			VAPIDPrivateKey: os.Getenv("VAPID_PRIVATE_KEY"),
			TTL:             86400,
			Urgency:         webpush.UrgencyNormal,
		})
		if err != nil {
			log.Printf("push to %s: %v", userId, err)
			continue
		}
		res.Body.Close()
		if res.StatusCode == http.StatusGone || res.StatusCode == http.StatusNotFound {
			DeleteSubscription(n.svc, userId, dynamo.S(s, "Endpoint"))
		} else if res.StatusCode >= 400 {
			log.Printf("push to %s: status %d", userId, res.StatusCode)
		}
	}
}
