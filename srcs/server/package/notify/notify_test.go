package notify

import (
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"local.com/dynamo"
	"local.com/mailer"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

// fakeDB plays a Users row (returned by the counter update), the
// notifications table and push subscriptions.
type fakeDB struct {
	dynamodbiface.DynamoDBAPI
	user    dynamo.Item
	puts    []*dynamodb.PutItemInput
	updates []*dynamodb.UpdateItemInput
	deletes int
	queued  []dynamo.Item // rows returned for the queue / pending queries
	subs    []dynamo.Item
}

func (f *fakeDB) PutItem(in *dynamodb.PutItemInput) (*dynamodb.PutItemOutput, error) {
	f.puts = append(f.puts, in)
	return &dynamodb.PutItemOutput{}, nil
}

func (f *fakeDB) UpdateItem(in *dynamodb.UpdateItemInput) (*dynamodb.UpdateItemOutput, error) {
	f.updates = append(f.updates, in)
	return &dynamodb.UpdateItemOutput{Attributes: f.user}, nil
}

func (f *fakeDB) GetItem(*dynamodb.GetItemInput) (*dynamodb.GetItemOutput, error) {
	return &dynamodb.GetItemOutput{Item: f.user}, nil
}

func (f *fakeDB) DeleteItem(*dynamodb.DeleteItemInput) (*dynamodb.DeleteItemOutput, error) {
	f.deletes++
	return &dynamodb.DeleteItemOutput{}, nil
}

func (f *fakeDB) QueryPages(in *dynamodb.QueryInput, fn func(*dynamodb.QueryOutput, bool) bool) error {
	if *in.TableName == PushTable {
		fn(&dynamodb.QueryOutput{Items: f.subs}, true)
	} else {
		fn(&dynamodb.QueryOutput{Items: f.queued}, true)
	}
	return nil
}

var clock = time.UnixMilli(1_700_000_000_000)

func newTest(user dynamo.Item) (*Notifier, *fakeDB) {
	f := &fakeDB{user: user}
	n := New(f)
	n.now = func() time.Time { return clock }
	return n, f
}

func member(prefs *dynamodb.AttributeValue) dynamo.Item {
	u := dynamo.Item{"UserId": {S: aws.String("author")}, "Email": {S: aws.String("a@b.c")}, "UserNickname": {S: aws.String("냥이")}}
	if prefs != nil {
		u["NotifyPrefs"] = prefs
	}
	return u
}

func TestPublishQueuesEmailByMode(t *testing.T) {
	t.Setenv("NOTIFY_DIGEST_DELAY", "15m")
	n, f := newTest(member(nil))
	if err := n.Publish(Event{UserId: "author", ActorId: "x", Type: TypeComment, Preview: strings.Repeat("가", 100)}); err != nil {
		t.Fatal(err)
	}
	item := f.puts[0].Item
	if dynamo.S(item, "EmailQueue") != "pending" || *item["DueAt"].N != "1700000900000" {
		t.Errorf("digest event: queue %q due %v, want pending at now+15m", dynamo.S(item, "EmailQueue"), item["DueAt"])
	}
	if got := *item["ExpiresAt"].N; got != "1707776000" {
		t.Errorf("ExpiresAt = %s, want now+90d in seconds", got)
	}
	if got := []rune(dynamo.S(item, "Preview")); len(got) != previewMax+1 {
		t.Errorf("preview has %d runes, want truncated", len(got))
	}
	if *f.updates[0].UpdateExpression != "ADD UnreadCount :d" {
		t.Errorf("first write must bump the counter: %s", *f.updates[0].UpdateExpression)
	}

	n.Publish(Event{UserId: "author", Type: TypeAccepted})
	if *f.puts[1].Item["DueAt"].N != "1700000000000" {
		t.Errorf("immediate event due %v, want now", f.puts[1].Item["DueAt"])
	}
}

func TestPublishRespectsSettings(t *testing.T) {
	off := (Prefs{EmailEnabled: false}).item()
	n, f := newTest(member(off))
	n.Publish(Event{UserId: "author", Type: TypeAccepted})
	if _, queued := f.puts[0].Item["EmailQueue"]; queued || dynamo.S(f.puts[0].Item, "EmailState") != EmailNone {
		t.Error("unsubscribed member still queued for mail")
	}

	replyOff := (Prefs{EmailEnabled: true, Email: map[string]string{TypeReply: EmailOff}}).item()
	n, f = newTest(member(replyOff))
	n.Publish(Event{UserId: "author", Type: TypeReply})
	if _, queued := f.puts[0].Item["EmailQueue"]; queued {
		t.Error("type switched off still queued")
	}

	noEmail := member(nil)
	delete(noEmail, "Email")
	n, f = newTest(noEmail)
	n.Publish(Event{UserId: "author", Type: TypeAccepted})
	if _, queued := f.puts[0].Item["EmailQueue"]; queued {
		t.Error("member without an address queued for mail")
	}
}

func TestPublishSkipsOwnActions(t *testing.T) {
	n, f := newTest(member(nil))
	n.Publish(Event{UserId: "u1", ActorId: "u1", Type: TypeComment})
	n.Publish(Event{UserId: "", ActorId: "u2", Type: TypeComment})
	if len(f.puts)+len(f.updates) != 0 {
		t.Error("own actions must not be stored")
	}
}

func TestComposeMail(t *testing.T) {
	one := composeMail("ko", "냥이", []Notification{{Type: TypeAccepted, Preview: "CAF 질문", Link: "/community/p1#c-1"}}, "https://itnyang.test", "https://itnyang.test/u")
	if one.Subject != "[잇냥] 내 답변이 채택됐어요" || !strings.Contains(one.Body, "https://itnyang.test/community/p1#c-1") {
		t.Errorf("single mail = %+v", one)
	}
	many := composeMail("", "", []Notification{{Type: TypeComment}, {Type: TypeReply}}, "https://x", "https://x/u")
	if many.Subject != "[잇냥] 새 알림 2개" || !strings.Contains(many.Body, "이웃님") || !strings.Contains(many.Body, "https://x/u") {
		t.Errorf("digest mail = %+v", many)
	}
	fr := composeMail("fr", "Mina", []Notification{{Type: TypeComment}, {Type: TypeReply}}, "https://x", "https://x/u")
	if fr.Subject != "[Itnyang] 2 nouvelles notifications" || !strings.Contains(fr.Body, "Bonjour Mina") || !strings.Contains(fr.Body, "Nouvelle réponse à votre commentaire") {
		t.Errorf("french mail = %+v", fr)
	}
	en := composeMail("en", "", []Notification{{Type: TypeAccepted}}, "https://x", "https://x/u")
	if en.Subject != "[Itnyang] Your answer was accepted" || !strings.Contains(en.Body, "Hi neighbour") {
		t.Errorf("english mail = %+v", en)
	}
}

func TestSendDueEmails(t *testing.T) {
	var sent []mailer.Message
	orig := send
	send = func(m mailer.Message) error { sent = append(sent, m); return nil }
	t.Cleanup(func() { send = orig })
	t.Setenv("PUBLIC_API_URL", "https://api.test")

	row := func(key, typ string, read bool) dynamo.Item {
		return dynamo.Item{
			"UserId": {S: aws.String("author")}, "SortKey": {S: aws.String(key)}, "Type": {S: aws.String(typ)},
			"Preview": {S: aws.String("내용 " + key)}, "Read": {BOOL: aws.Bool(read)},
		}
	}
	n, f := newTest(member(nil))
	f.queued = []dynamo.Item{row("1", TypeComment, false), row("2", TypeReply, false), row("3", TypeComment, true)}
	if err := n.SendDueEmails(); err != nil {
		t.Fatal(err)
	}
	if len(sent) != 1 {
		t.Fatalf("sent %d mails, want one digest", len(sent))
	}
	m := sent[0]
	if m.To != "a@b.c" || m.Subject != "[잇냥] 새 알림 2개" || strings.Contains(m.Body, "내용 3") {
		t.Errorf("mail = %+v (read notifications must be left out)", m)
	}
	if !strings.HasPrefix(m.Headers["List-Unsubscribe"], "<https://api.test/notifications/unsubscribe?u=author&t=") {
		t.Errorf("List-Unsubscribe = %q", m.Headers["List-Unsubscribe"])
	}
	if len(f.updates) != 3 {
		t.Errorf("dequeued %d rows, want all 3", len(f.updates))
	}

	// Everything already read on the site: no mail, rows skipped.
	sent = nil
	n, f = newTest(member(nil))
	f.queued = []dynamo.Item{row("4", TypeComment, true)}
	n.SendDueEmails()
	if len(sent) != 0 || len(f.updates) != 1 || *f.updates[0].ExpressionAttributeValues[":s"].S != EmailSkipped {
		t.Errorf("read-only queue: sent %d, updates %d", len(sent), len(f.updates))
	}
}

func TestUnsubscribeToken(t *testing.T) {
	n, _ := newTest(member(nil))
	if Unsubscribe(n.svc, "author", "forged") {
		t.Error("forged token accepted")
	}
	if !Unsubscribe(n.svc, "author", UnsubscribeToken("author")) {
		t.Error("valid token refused")
	}
}

func TestSettingsDefaultsAndSave(t *testing.T) {
	n, f := newTest(member(nil))
	enabled, hasEmail, rows, err := Settings(n.svc, "author")
	if err != nil || !enabled || !hasEmail || len(rows) != len(Types) {
		t.Fatalf("settings = %v %v %v %v", enabled, hasEmail, rows, err)
	}
	if rows[0].Type != TypeComment || rows[0].Email != EmailDigest || !rows[0].Push {
		t.Errorf("comment defaults = %+v", rows[0])
	}
	SaveSettings(n.svc, "author", nil, []Setting{{Type: TypeComment, Email: EmailOff, Push: false}, {Type: "bogus", Email: EmailOff}})
	saved := PrefsOf(dynamo.Item{"NotifyPrefs": f.updates[0].ExpressionAttributeValues[":p"]})
	if saved.EmailMode(TypeComment) != EmailOff || saved.PushOn(TypeComment) || len(saved.Email) != 1 {
		t.Errorf("saved prefs = %+v", saved)
	}
}

func TestPushPayloadAndCleanup(t *testing.T) {
	p := string(payloadFor("ko", Notification{Type: TypeChat, Preview: "안녕하세요", Link: "https://evil.example", TargetId: "c1"}))
	if !strings.Contains(p, `"url":"/notifications"`) || !strings.Contains(p, "새 채팅 메시지") {
		t.Errorf("payload = %s", p)
	}

	var calls int
	orig := sendPush
	sendPush = func([]byte, *webpush.Subscription, *webpush.Options) (*http.Response, error) {
		calls++
		status := http.StatusCreated
		if calls == 2 {
			status = http.StatusGone
		}
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(""))}, nil
	}
	t.Cleanup(func() { sendPush = orig })
	n, f := newTest(member(nil))
	sub := func(endpoint string) dynamo.Item {
		return dynamo.Item{"Endpoint": {S: aws.String(endpoint)}, "P256dh": {S: aws.String("k")}, "Auth": {S: aws.String("a")}}
	}
	f.subs = []dynamo.Item{sub("https://push.test/1"), sub("https://push.test/2")}
	n.deliverPush("author", "ko", Notification{Type: TypeReply, Link: "/community/p"})
	if calls != 2 || f.deletes != 1 {
		t.Errorf("calls %d, deletes %d; want both devices tried and the gone one removed", calls, f.deletes)
	}
}

func TestSaveSubscriptionValidates(t *testing.T) {
	n, _ := newTest(member(nil))
	bad := Subscription{Endpoint: "http://insecure.example/x"}
	bad.Keys.P256dh, bad.Keys.Auth = "k", "a"
	if SaveSubscription(n.svc, "u", bad) != ErrBadSubscription {
		t.Error("non-https endpoint accepted")
	}
	good := bad
	good.Endpoint = "https://fcm.googleapis.com/fcm/send/abc"
	if err := SaveSubscription(n.svc, "u", good); err != nil {
		t.Errorf("valid subscription refused: %v", err)
	}
}
