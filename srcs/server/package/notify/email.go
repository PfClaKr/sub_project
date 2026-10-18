package notify

import (
	"context"
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"local.com/dynamo"
	"local.com/i18n"
	"local.com/mailer"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

// Email delivery. A notification wanting mail carries EmailQueue
// ("pending") and DueAt; EmailQueueIndex (sparse: only queued rows) lets
// the worker find what is due without scanning. Immediate events are due
// at once; digest events wait DigestDelay, and whatever else is pending
// for that member by then goes into the same mail.
const (
	EmailQueueIndex = "EmailQueueIndex"
	emailQueued     = "pending"
	EmailSkipped    = "skipped" // read on the site before the mail went out
)

// DigestDelay is how long digest events wait (NOTIFY_DIGEST_DELAY, a Go
// duration; default 15m).
func DigestDelay() time.Duration {
	if d, err := time.ParseDuration(os.Getenv("NOTIFY_DIGEST_DELAY")); err == nil && d >= 0 {
		return d
	}
	return 15 * time.Minute
}

// send is swapped in tests.
var send = mailer.SendMessage

// composeMail builds one mail in the member's language (Users.Locale).
// To and the headers are left to the caller.
func composeMail(lang, nickname string, items []Notification, appURL, unsubscribe string) mailer.Message {
	subject, content := composeContent(lang, nickname, items, appURL, unsubscribe)
	return content.Message("", subject)
}

// composeContent: a card per notification, a button to the notification
// list, and the settings and unsubscribe links (unsubscribe is the page
// link).
func composeContent(lang, nickname string, items []Notification, appURL, unsubscribe string) (string, mailer.Content) {
	name := nickname
	if name == "" {
		name = i18n.T(lang, "이웃")
	}
	content := mailer.Content{
		Lang:    lang,
		Heading: i18n.T(lang, "%s님, 잇냥에서 알려드려요.", name),
		Button:  mailer.Link{Label: i18n.T(lang, "알림 모두 보기"), URL: appURL + "/notifications"},
		Notes:   []string{i18n.T(lang, "잇냥 알림 설정에 따라 보내드리는 메일이에요.")},
		Footer: []mailer.Link{
			{Label: i18n.T(lang, "알림 설정"), URL: appURL + "/myaccount/notifications"},
			{Label: i18n.T(lang, "이메일 알림 끄기"), URL: unsubscribe},
		},
	}
	for _, n := range items {
		item := mailer.Item{Title: TitleIn(lang, n.Type), Text: n.Preview}
		if n.Link != "" {
			item.Link = mailer.Link{Label: i18n.T(lang, "보기"), URL: appURL + n.Link}
		}
		content.Items = append(content.Items, item)
	}
	content.Preheader = content.Items[0].Title
	if p := items[0].Preview; p != "" {
		content.Preheader += " · " + p
	}

	subject := i18n.T(lang, "[잇냥] %s", TitleIn(lang, items[0].Type))
	if len(items) > 1 {
		subject = i18n.T(lang, "[잇냥] 새 알림 %d개", len(items))
	}
	return subject, content
}

// SampleMail is a two-notification digest with made-up content, for the
// admin preview of the mail design.
func SampleMail(lang string) (string, mailer.Content) {
	appURL := mailer.AppURL()
	return composeContent(lang, "", []Notification{
		{Type: TypeComment, Preview: "CAF 서류는 이렇게 준비했어요", Link: "/community"},
		{Type: TypeAccepted, Preview: "은행 계좌 여는 순서 정리", Link: "/community"},
	}, appURL, appURL+"/notifications/unsubscribe")
}

func unsubscribeQuery(userId string) string {
	return "u=" + url.QueryEscape(userId) + "&t=" + UnsubscribeToken(userId)
}

// SendDueEmails mails every member who has a due notification. It is run
// periodically by RunEmailWorker.
func (n *Notifier) SendDueEmails() error {
	now := n.now()
	due, err := dynamo.QueryAll(n.svc, &dynamodb.QueryInput{
		TableName:              aws.String(Table),
		IndexName:              aws.String(EmailQueueIndex),
		KeyConditionExpression: aws.String("EmailQueue = :q AND DueAt <= :now"),
		ExpressionAttributeValues: dynamo.Item{
			":q": {S: aws.String(emailQueued)}, ":now": {N: aws.String(strconv.FormatInt(now.UnixMilli(), 10))},
		},
		ProjectionExpression: aws.String("UserId"),
	})
	if err != nil {
		return err
	}
	seen := map[string]bool{}
	for _, d := range due {
		userId := dynamo.S(d, "UserId")
		if seen[userId] {
			continue
		}
		seen[userId] = true
		if err := n.mailUser(userId); err != nil {
			log.Printf("notification mail to %s: %v", userId, err)
		}
	}
	return nil
}

// mailUser sends one mail with all of a member's pending, unread
// notifications, then takes them off the queue.
func (n *Notifier) mailUser(userId string) error {
	items, err := dynamo.QueryAll(n.svc, &dynamodb.QueryInput{
		TableName:                 aws.String(Table),
		KeyConditionExpression:    aws.String("UserId = :u"),
		FilterExpression:          aws.String("EmailQueue = :q"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(userId)}, ":q": {S: aws.String(emailQueued)}},
	})
	if err != nil {
		return err
	}
	user, err := getUser(n.svc, userId)
	if err != nil {
		return err
	}
	var unread []Notification
	for _, it := range items {
		if v := it["Read"]; v != nil && v.BOOL != nil && *v.BOOL {
			continue
		}
		unread = append(unread, Notification{
			Type: dynamo.S(it, "Type"), Preview: dynamo.S(it, "Preview"), Link: dynamo.S(it, "Link"),
		})
	}
	state := EmailSkipped
	email := dynamo.S(user, "Email")
	if len(unread) > 0 && email != "" && PrefsOf(user).EmailEnabled {
		appURL := mailer.AppURL()
		mail := composeMail(dynamo.S(user, "Locale"), dynamo.S(user, "UserNickname"), unread, appURL, appURL+"/notifications/unsubscribe?"+unsubscribeQuery(userId))
		mail.To = email
		headers := map[string]string{}
		// RFC 8058 one-click unsubscribe, when the API URL is known.
		if api := strings.TrimRight(os.Getenv("PUBLIC_API_URL"), "/"); api != "" {
			headers["List-Unsubscribe"] = "<" + api + "/notifications/unsubscribe?" + unsubscribeQuery(userId) + ">"
			headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
		}
		mail.Headers = headers
		if err := send(mail); err != nil {
			return err // stays queued; retried on the next run
		}
		state = EmailSent
	}
	for _, it := range items {
		if _, err := n.svc.UpdateItem(&dynamodb.UpdateItemInput{
			TableName:                 aws.String(Table),
			Key:                       dynamo.Item{"UserId": it["UserId"], "SortKey": it["SortKey"]},
			UpdateExpression:          aws.String("SET EmailState = :s REMOVE EmailQueue, DueAt"),
			ExpressionAttributeValues: dynamo.Item{":s": {S: aws.String(state)}},
		}); err != nil {
			return err
		}
	}
	return nil
}

// RunEmailWorker sends due mails every interval (NOTIFY_EMAIL_INTERVAL,
// default 1m) until ctx is done.
func RunEmailWorker(ctx context.Context, n *Notifier) {
	interval := time.Minute
	if d, err := time.ParseDuration(os.Getenv("NOTIFY_EMAIL_INTERVAL")); err == nil && d > 0 {
		interval = d
	}
	for {
		if err := n.SendDueEmails(); err != nil {
			log.Printf("notification mails: %v", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(interval):
		}
	}
}
