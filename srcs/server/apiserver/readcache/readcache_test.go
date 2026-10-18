package readcache

import (
	"testing"
	"time"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

type fakeDB struct {
	dynamodbiface.DynamoDBAPI
	reads []int // keys per BatchGetItem call
	names map[string]string
}

func (f *fakeDB) BatchGetItem(in *dynamodb.BatchGetItemInput) (*dynamodb.BatchGetItemOutput, error) {
	var items []map[string]*dynamodb.AttributeValue
	for table, ka := range in.RequestItems {
		f.reads = append(f.reads, len(ka.Keys))
		for _, k := range ka.Keys {
			id := *k["UserId"].S
			if name, ok := f.names[id]; ok {
				items = append(items, dynamo.Item{"UserId": {S: aws.String(id)}, "UserNickname": {S: aws.String(name)}})
			}
		}
		return &dynamodb.BatchGetItemOutput{Responses: map[string][]map[string]*dynamodb.AttributeValue{table: items}}, nil
	}
	return &dynamodb.BatchGetItemOutput{}, nil
}

func TestCacheReadsOnlyWhatItLacks(t *testing.T) {
	db := &fakeDB{names: map[string]string{"a": "냥이", "b": "Mina"}}
	now := time.Unix(1000, 0)
	c := New("Users", "UserId", "UserId, UserNickname", time.Minute, 100)
	c.now = func() time.Time { return now }

	got, err := c.BatchGet(db, []string{"a", "b", "gone"})
	if err != nil || dynamo.S(got["a"], "UserNickname") != "냥이" || len(got) != 2 {
		t.Fatalf("first read = %v, %v", got, err)
	}
	got, _ = c.BatchGet(db, []string{"a", "b"})
	if len(db.reads) != 1 || len(got) != 2 {
		t.Errorf("cached ids were read again: %v", db.reads)
	}

	// Callers get copies: changing one does not touch the cache.
	delete(got["a"], "UserNickname")
	if again, _ := c.BatchGet(db, []string{"a"}); dynamo.S(again["a"], "UserNickname") != "냥이" {
		t.Error("a caller's change leaked into the cache")
	}

	// A write forgets the item; the TTL expires the rest.
	db.names["a"] = "새이름"
	c.Forget("a")
	if got, _ := c.BatchGet(db, []string{"a", "b"}); dynamo.S(got["a"], "UserNickname") != "새이름" || db.reads[len(db.reads)-1] != 1 {
		t.Errorf("after Forget: %v, reads %v", got, db.reads)
	}
	now = now.Add(2 * time.Minute)
	c.BatchGet(db, []string{"a", "b"})
	if db.reads[len(db.reads)-1] != 2 {
		t.Errorf("expired items were not read again: %v", db.reads)
	}
	if c.Hits.Load() == 0 || c.Misses.Load() == 0 {
		t.Error("hit/miss counters not kept")
	}
}

func TestCacheStaysBounded(t *testing.T) {
	db := &fakeDB{names: map[string]string{}}
	for _, id := range []string{"1", "2", "3", "4", "5"} {
		db.names[id] = id
	}
	c := New("Users", "UserId", "", time.Hour, 3)
	c.BatchGet(db, []string{"1", "2", "3"})
	c.BatchGet(db, []string{"4", "5"})
	if len(c.entries) > 3 {
		t.Errorf("%d entries, max 3", len(c.entries))
	}
}
