package notify

import (
	"strings"
	"testing"
	"time"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

type fakeDB struct {
	dynamodbiface.DynamoDBAPI
	puts    []*dynamodb.PutItemInput
	updates []*dynamodb.UpdateItemInput
}

func (f *fakeDB) PutItem(in *dynamodb.PutItemInput) (*dynamodb.PutItemOutput, error) {
	f.puts = append(f.puts, in)
	return &dynamodb.PutItemOutput{}, nil
}

func (f *fakeDB) UpdateItem(in *dynamodb.UpdateItemInput) (*dynamodb.UpdateItemOutput, error) {
	f.updates = append(f.updates, in)
	return &dynamodb.UpdateItemOutput{}, nil
}

func newTest() (*Notifier, *fakeDB) {
	f := &fakeDB{}
	n := New(f)
	n.now = func() time.Time { return time.UnixMilli(1_700_000_000_000) }
	return n, f
}

func TestPublishStoresAndCounts(t *testing.T) {
	n, f := newTest()
	err := n.Publish(Event{
		UserId: "author", ActorId: "commenter", Type: TypeComment,
		TargetType: "post", TargetId: "p1", Link: "/community/p1",
		Preview: strings.Repeat("가", 100),
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(f.puts) != 1 || len(f.updates) != 1 {
		t.Fatalf("puts=%d updates=%d, want 1 and 1", len(f.puts), len(f.updates))
	}
	item := f.puts[0].Item
	if got := dynamo.S(item, "SortKey"); !strings.HasPrefix(got, "1700000000000#") {
		t.Errorf("SortKey = %q", got)
	}
	if got := *item["ExpiresAt"].N; got != "1707776000" {
		t.Errorf("ExpiresAt = %s, want now+90d in seconds", got)
	}
	if got := dynamo.S(item, "EmailState"); got != EmailPending {
		t.Errorf("EmailState = %q, want pending (comments are digested)", got)
	}
	if item["Read"].BOOL == nil || *item["Read"].BOOL {
		t.Error("new notification must be stored unread")
	}
	if got := []rune(dynamo.S(item, "Preview")); len(got) != previewMax+1 {
		t.Errorf("preview has %d runes, want truncated to %d + …", len(got), previewMax)
	}
	if got := *f.updates[0].UpdateExpression; got != "ADD UnreadCount :d" {
		t.Errorf("counter update = %q", got)
	}
}

func TestPublishSkipsOwnActions(t *testing.T) {
	n, f := newTest()
	n.Publish(Event{UserId: "u1", ActorId: "u1", Type: TypeComment})
	n.Publish(Event{UserId: "", ActorId: "u2", Type: TypeComment})
	if len(f.puts) != 0 {
		t.Errorf("stored %d notifications, want none", len(f.puts))
	}
}

func TestNoticeHasNoEmail(t *testing.T) {
	n, f := newTest()
	n.Publish(Event{UserId: "u1", Type: TypeNotice})
	if got := dynamo.S(f.puts[0].Item, "EmailState"); got != EmailNone {
		t.Errorf("EmailState = %q, want none", got)
	}
}
