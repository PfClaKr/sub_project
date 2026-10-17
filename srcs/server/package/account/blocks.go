package account

import (
	"sort"
	"strconv"
	"time"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

// Blocks: a member (UserId) blocks another (BlockedId). Two members who
// block each other in either direction cannot start a chat or send
// messages; the blocked side only learns "대화할 수 없는 상대예요".

// BlockedMessage is shown to both sides; it does not say who blocked.
const BlockedMessage = "대화할 수 없는 상대예요."

// BlockState is the relation between a viewer and another member.
type BlockState struct {
	ByMe   bool // the viewer blocked the other member
	ByThem bool // the other member blocked the viewer
}

// Any reports whether either side blocked the other.
func (b BlockState) Any() bool { return b.ByMe || b.ByThem }

func blockKey(userId, blockedId string) dynamo.Item {
	return dynamo.Item{"UserId": {S: aws.String(userId)}, "BlockedId": {S: aws.String(blockedId)}}
}

// Blocks reads both directions between viewer and other in one batch.
func Blocks(svc dynamodbiface.DynamoDBAPI, viewer, other string) (BlockState, error) {
	if viewer == "" || other == "" || viewer == other {
		return BlockState{}, nil
	}
	out, err := svc.BatchGetItem(&dynamodb.BatchGetItemInput{
		RequestItems: map[string]*dynamodb.KeysAndAttributes{
			dynamo.TableBlocks: {
				Keys:                 []dynamo.Item{blockKey(viewer, other), blockKey(other, viewer)},
				ProjectionExpression: aws.String("UserId"),
			},
		},
	})
	if err != nil {
		return BlockState{}, err
	}
	var st BlockState
	for _, it := range out.Responses[dynamo.TableBlocks] {
		if dynamo.S(it, "UserId") == viewer {
			st.ByMe = true
		} else {
			st.ByThem = true
		}
	}
	return st, nil
}

// Block records that userId blocks blockedId (idempotent).
func Block(svc dynamodbiface.DynamoDBAPI, userId, blockedId string) error {
	item := blockKey(userId, blockedId)
	item["CreatedAt"] = &dynamodb.AttributeValue{N: aws.String(strconv.FormatInt(time.Now().UnixMilli(), 10))}
	_, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TableBlocks), Item: item})
	return err
}

// Unblock removes the block (no error when there was none).
func Unblock(svc dynamodbiface.DynamoDBAPI, userId, blockedId string) error {
	_, err := svc.DeleteItem(&dynamodb.DeleteItemInput{TableName: aws.String(dynamo.TableBlocks), Key: blockKey(userId, blockedId)})
	return err
}

// BlockedBy lists the members userId blocked, newest first.
func BlockedBy(svc dynamodbiface.DynamoDBAPI, userId string) ([]dynamo.Item, error) {
	items, err := dynamo.QueryAll(svc, &dynamodb.QueryInput{
		TableName:                 aws.String(dynamo.TableBlocks),
		KeyConditionExpression:    aws.String("UserId = :u"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(userId)}},
	})
	if err != nil {
		return nil, err
	}
	// Few rows per member: sort in memory rather than add an index.
	sort.Slice(items, func(i, j int) bool { return num(items[i], "CreatedAt") > num(items[j], "CreatedAt") })
	return items, nil
}

func num(item dynamo.Item, name string) int64 {
	if v := item[name]; v != nil && v.N != nil {
		n, _ := strconv.ParseInt(*v.N, 10, 64)
		return n
	}
	return 0
}
