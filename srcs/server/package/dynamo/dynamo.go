// Package dynamo holds the shared DynamoDB client setup and helpers
// every service needs.
package dynamo

import (
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

// Table names shared across services.
const (
	TableUsers           = "Users"
	TableUsersCredential = "UsersCredential"
	TableProduct         = "Product"
	TableFavorites       = "Favorites"
	TableChatRooms       = "ChatRooms"
	TableChatMessage     = "ChatMessage"
)

type Item = map[string]*dynamodb.AttributeValue

// New builds a client from AWS_REGION, DYNAMODB_ENDPOINT and the
// static AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY credentials.
func New() dynamodbiface.DynamoDBAPI {
	cfg := &aws.Config{Region: aws.String(os.Getenv("AWS_REGION"))}
	if ep := os.Getenv("DYNAMODB_ENDPOINT"); ep != "" {
		cfg.Endpoint = aws.String(ep)
	}
	if id := os.Getenv("AWS_ACCESS_KEY_ID"); id != "" {
		cfg.Credentials = credentials.NewStaticCredentials(id, os.Getenv("AWS_SECRET_ACCESS_KEY"), "")
	}
	return dynamodb.New(session.Must(session.NewSession(cfg)))
}

// ScanAll follows LastEvaluatedKey so results are not silently cut at
// the 1MB page limit. The input is modified.
func ScanAll(svc dynamodbiface.DynamoDBAPI, input *dynamodb.ScanInput) ([]Item, error) {
	var items []Item
	err := svc.ScanPages(input, func(page *dynamodb.ScanOutput, _ bool) bool {
		items = append(items, page.Items...)
		return true
	})
	return items, err
}

// QueryAll is ScanAll for queries.
func QueryAll(svc dynamodbiface.DynamoDBAPI, input *dynamodb.QueryInput) ([]Item, error) {
	var items []Item
	err := svc.QueryPages(input, func(page *dynamodb.QueryOutput, _ bool) bool {
		items = append(items, page.Items...)
		return true
	})
	return items, err
}

// BatchGet fetches items by a single string hash key and returns them
// keyed by id. Missing ids are simply absent. projection may be "".
func BatchGet(svc dynamodbiface.DynamoDBAPI, table, keyName string, ids []string, projection string) (map[string]Item, error) {
	out := map[string]Item{}
	seen := map[string]bool{}
	var keys []Item
	for _, id := range ids {
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		keys = append(keys, Item{keyName: {S: aws.String(id)}})
	}

	// BatchGetItem accepts at most 100 keys per call.
	for start := 0; start < len(keys); start += 100 {
		end := start + 100
		if end > len(keys) {
			end = len(keys)
		}
		ka := &dynamodb.KeysAndAttributes{Keys: keys[start:end]}
		if projection != "" {
			ka.ProjectionExpression = aws.String(projection)
		}
		req := map[string]*dynamodb.KeysAndAttributes{table: ka}
		for len(req) > 0 {
			res, err := svc.BatchGetItem(&dynamodb.BatchGetItemInput{RequestItems: req})
			if err != nil {
				return nil, err
			}
			for _, item := range res.Responses[table] {
				if v := item[keyName]; v != nil && v.S != nil {
					out[*v.S] = item
				}
			}
			req = res.UnprocessedKeys
		}
	}
	return out, nil
}

// S returns a string attribute or "".
func S(item Item, name string) string {
	if v := item[name]; v != nil && v.S != nil {
		return *v.S
	}
	return ""
}
