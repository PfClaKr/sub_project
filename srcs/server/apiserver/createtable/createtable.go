package createtable

import (
	"fmt"
	"log"
	"time"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

type tableDef struct {
	name    string
	schema  []*dynamodb.KeySchemaElement
	attribs []*dynamodb.AttributeDefinition
	indexes []*dynamodb.GlobalSecondaryIndex
	ttl     string // attribute DynamoDB expires rows by (epoch seconds)
}

// Every GSI is billed on each write, so only indexes that a query uses
// are declared; lists and searches go through Elasticsearch instead.
var tables = []tableDef{
	{
		name:    dynamo.TableUsers,
		schema:  hashKey("UserId"),
		attribs: []*dynamodb.AttributeDefinition{attr("UserId", "S")},
	},
	{
		// VerifyTokenIndex finds the account of an email verification
		// link; sparse, since only unverified rows carry a token.
		name:    dynamo.TableUsersCredential,
		schema:  hashKey("Email"),
		attribs: []*dynamodb.AttributeDefinition{attr("Email", "S"), attr("VerifyToken", "S")},
		indexes: []*dynamodb.GlobalSecondaryIndex{index("VerifyTokenIndex", hashKey("VerifyToken"))},
	},
	{
		// UserIndex: a member's products, newest first.
		name:    dynamo.TableProduct,
		schema:  hashKey("ProductId"),
		attribs: []*dynamodb.AttributeDefinition{attr("ProductId", "S"), attr("UserId", "S"), attr("ProductCreatedAt", "N")},
		indexes: []*dynamodb.GlobalSecondaryIndex{index("UserIndex", hashRangeKey("UserId", "ProductCreatedAt"))},
	},
	{
		name:    dynamo.TableFavorites,
		schema:  hashRangeKey("UserId", "ItemId"),
		attribs: []*dynamodb.AttributeDefinition{attr("UserId", "S"), attr("ItemId", "S")},
	},
	{
		// A member's rooms are the union of the rooms where they sell and
		// those where they started the conversation.
		name:    dynamo.TableChatRooms,
		schema:  hashKey("ChatId"),
		attribs: []*dynamodb.AttributeDefinition{attr("ChatId", "S"), attr("UserSeller", "S"), attr("UserBuyer", "S"), attr("CreatedAt", "N")},
		indexes: []*dynamodb.GlobalSecondaryIndex{
			index("SellerIndex", hashRangeKey("UserSeller", "CreatedAt")),
			index("BuyerIndex", hashRangeKey("UserBuyer", "CreatedAt")),
		},
	},
	{
		// Town / arrondissement boundaries cached from OpenStreetMap.
		name:    "GeoAreas",
		schema:  hashKey("AreaId"),
		attribs: []*dynamodb.AttributeDefinition{attr("AreaId", "S")},
	},
	{
		// ChatIndex: one room's history in time order.
		name:    dynamo.TableChatMessage,
		schema:  hashKey("MessageId"),
		attribs: []*dynamodb.AttributeDefinition{attr("MessageId", "S"), attr("ChatId", "S"), attr("Timestamp", "N")},
		indexes: []*dynamodb.GlobalSecondaryIndex{index("ChatIndex", hashRangeKey("ChatId", "Timestamp"))},
	},
	{
		// Community posts of every board (free, qna, housing, job).
		// Lists and filters go through Elasticsearch; the index serves
		// "my posts".
		name:    dynamo.TablePosts,
		schema:  hashKey("PostId"),
		attribs: []*dynamodb.AttributeDefinition{attr("PostId", "S"), attr("AuthorId", "S"), attr("CreatedAt", "N")},
		indexes: []*dynamodb.GlobalSecondaryIndex{authorIndex()},
	},
	{
		// CommentId sorts by time, so one Query returns a thread in order.
		name:    dynamo.TableComments,
		schema:  hashRangeKey("PostId", "CommentId"),
		attribs: []*dynamodb.AttributeDefinition{attr("PostId", "S"), attr("CommentId", "S"), attr("AuthorId", "S"), attr("CreatedAt", "N")},
		indexes: []*dynamodb.GlobalSecondaryIndex{authorIndex()},
	},
	{
		name:    dynamo.TablePostLikes,
		schema:  hashRangeKey("UserId", "PostId"),
		attribs: []*dynamodb.AttributeDefinition{attr("UserId", "S"), attr("PostId", "S")},
	},
	{
		name:    dynamo.TableBookmarks,
		schema:  hashRangeKey("UserId", "PostId"),
		attribs: []*dynamodb.AttributeDefinition{attr("UserId", "S"), attr("PostId", "S")},
	},
	{
		// ReportId is derived from (target, reporter): one report each.
		name:    dynamo.TableReports,
		schema:  hashKey("ReportId"),
		attribs: []*dynamodb.AttributeDefinition{attr("ReportId", "S")},
	},
	{
		// EmailQueueIndex holds only notifications waiting for a mail
		// (EmailQueue + DueAt are removed once sent), so the mail worker
		// queries what is due instead of scanning.
		name:    dynamo.TableNotifications,
		schema:  hashRangeKey("UserId", "SortKey"),
		attribs: []*dynamodb.AttributeDefinition{attr("UserId", "S"), attr("SortKey", "S"), attr("EmailQueue", "S"), attr("DueAt", "N")},
		indexes: []*dynamodb.GlobalSecondaryIndex{index("EmailQueueIndex", hashRangeKey("EmailQueue", "DueAt"))},
		ttl:     "ExpiresAt",
	},
	{
		// Web push devices of a member (EndpointHash = hash of the push
		// service URL).
		name:    dynamo.TablePushSubs,
		schema:  hashRangeKey("UserId", "EndpointHash"),
		attribs: []*dynamodb.AttributeDefinition{attr("UserId", "S"), attr("EndpointHash", "S")},
	},
}

// obsoleteIndexes were created by earlier versions and are not queried;
// they only add write costs, so they are dropped from existing tables.
var obsoleteIndexes = map[string][]string{
	dynamo.TableUsers:       {"UserEmailIndex"},
	dynamo.TableProduct:     {"ProductNameIndex"},
	dynamo.TableChatMessage: {"TimestampIndex"},
}

// CreateTables creates missing tables and brings existing ones to the
// declared indexes, waiting for DynamoDB to come up.
func CreateTables(svc dynamodbiface.DynamoDBAPI) {
	for i := 0; ; i++ {
		if _, err := svc.ListTables(&dynamodb.ListTablesInput{}); err == nil {
			break
		} else if i == 30 {
			log.Fatalf("dynamodb unreachable: %v", err)
		} else {
			log.Printf("dynamodb not ready: %v. Retrying...", err)
			time.Sleep(2 * time.Second)
		}
	}

	for _, table := range tables {
		input := &dynamodb.CreateTableInput{
			TableName:            aws.String(table.name),
			KeySchema:            table.schema,
			AttributeDefinitions: table.attribs,
			// On-demand: nothing is billed while idle, and full scans
			// (reindex, admin lists) are never throttled by a small quota.
			BillingMode: aws.String(dynamodb.BillingModePayPerRequest),
		}
		if len(table.indexes) > 0 {
			input.GlobalSecondaryIndexes = table.indexes
		}

		_, err := svc.CreateTable(input)
		if err != nil {
			// Existing tables are fine; only unexpected errors are fatal.
			if aerr, ok := err.(awserr.Error); ok && aerr.Code() == dynamodb.ErrCodeResourceInUseException {
				fmt.Printf("Table %s already exists\n", table.name)
				continue
			}
			log.Fatalf("Got error calling CreateTable: %s", err)
		}
		fmt.Printf("Created the table %s\n", table.name)
	}

	// Real DynamoDB creates tables asynchronously; wait until they are
	// ACTIVE before anything reads them (instant on DynamoDB Local).
	for _, table := range tables {
		if err := svc.WaitUntilTableExists(&dynamodb.DescribeTableInput{TableName: aws.String(table.name)}); err != nil {
			log.Fatalf("table %s did not become active: %v", table.name, err)
		}
		syncIndexes(svc, table)
		if table.ttl != "" {
			enableTTL(svc, table.name, table.ttl)
		}
	}
}

// syncIndexes adds declared GSIs a table lacks (tables created by an
// earlier version) and drops obsolete ones. DynamoDB takes one index
// change per UpdateTable and backfills new indexes, so each change waits
// until the table is idle again.
func syncIndexes(svc dynamodbiface.DynamoDBAPI, table tableDef) {
	out, err := svc.DescribeTable(&dynamodb.DescribeTableInput{TableName: aws.String(table.name)})
	if err != nil {
		log.Fatalf("describe %s: %v", table.name, err)
	}
	existing := map[string]bool{}
	for _, gsi := range out.Table.GlobalSecondaryIndexes {
		existing[aws.StringValue(gsi.IndexName)] = true
	}

	for _, name := range obsoleteIndexes[table.name] {
		if !existing[name] {
			continue
		}
		log.Printf("dropping unused index %s.%s", table.name, name)
		if _, err := svc.UpdateTable(&dynamodb.UpdateTableInput{
			TableName:                   aws.String(table.name),
			GlobalSecondaryIndexUpdates: []*dynamodb.GlobalSecondaryIndexUpdate{{Delete: &dynamodb.DeleteGlobalSecondaryIndexAction{IndexName: aws.String(name)}}},
		}); err != nil {
			log.Printf("drop %s.%s: %v", table.name, name, err)
			continue
		}
		waitIdle(svc, table.name)
	}

	for _, gsi := range table.indexes {
		if existing[aws.StringValue(gsi.IndexName)] {
			continue
		}
		log.Printf("adding index %s.%s", table.name, aws.StringValue(gsi.IndexName))
		if _, err := svc.UpdateTable(&dynamodb.UpdateTableInput{
			TableName:            aws.String(table.name),
			AttributeDefinitions: table.attribs,
			GlobalSecondaryIndexUpdates: []*dynamodb.GlobalSecondaryIndexUpdate{{Create: &dynamodb.CreateGlobalSecondaryIndexAction{
				IndexName: gsi.IndexName, KeySchema: gsi.KeySchema, Projection: gsi.Projection,
			}}},
		}); err != nil {
			log.Fatalf("add index %s.%s: %v", table.name, aws.StringValue(gsi.IndexName), err)
		}
		waitIdle(svc, table.name)
	}
}

// waitIdle blocks until the table and all its indexes are ACTIVE (index
// backfills can take minutes on large real tables).
func waitIdle(svc dynamodbiface.DynamoDBAPI, table string) {
	for i := 0; i < 600; i++ {
		out, err := svc.DescribeTable(&dynamodb.DescribeTableInput{TableName: aws.String(table)})
		if err == nil && aws.StringValue(out.Table.TableStatus) == dynamodb.TableStatusActive {
			busy := false
			for _, gsi := range out.Table.GlobalSecondaryIndexes {
				if aws.StringValue(gsi.IndexStatus) != dynamodb.IndexStatusActive {
					busy = true
				}
			}
			if !busy {
				return
			}
		}
		time.Sleep(2 * time.Second)
	}
	log.Fatalf("table %s did not finish its index changes", table)
}

// enableTTL turns on expiry once; DynamoDB rejects enabling it twice.
// Failure is logged, not fatal: rows then simply stay.
func enableTTL(svc dynamodbiface.DynamoDBAPI, table, attribute string) {
	out, err := svc.DescribeTimeToLive(&dynamodb.DescribeTimeToLiveInput{TableName: aws.String(table)})
	if err == nil && out.TimeToLiveDescription != nil {
		switch aws.StringValue(out.TimeToLiveDescription.TimeToLiveStatus) {
		case dynamodb.TimeToLiveStatusEnabled, dynamodb.TimeToLiveStatusEnabling:
			return
		}
	}
	_, err = svc.UpdateTimeToLive(&dynamodb.UpdateTimeToLiveInput{
		TableName: aws.String(table),
		TimeToLiveSpecification: &dynamodb.TimeToLiveSpecification{
			AttributeName: aws.String(attribute),
			Enabled:       aws.Bool(true),
		},
	})
	if err != nil {
		log.Printf("enable TTL on %s: %v", table, err)
	}
}

func attr(name, typ string) *dynamodb.AttributeDefinition {
	return &dynamodb.AttributeDefinition{AttributeName: aws.String(name), AttributeType: aws.String(typ)}
}

func hashKey(name string) []*dynamodb.KeySchemaElement {
	return []*dynamodb.KeySchemaElement{{AttributeName: aws.String(name), KeyType: aws.String("HASH")}}
}

func hashRangeKey(hash, rng string) []*dynamodb.KeySchemaElement {
	return []*dynamodb.KeySchemaElement{
		{AttributeName: aws.String(hash), KeyType: aws.String("HASH")},
		{AttributeName: aws.String(rng), KeyType: aws.String("RANGE")},
	}
}

func index(name string, keys []*dynamodb.KeySchemaElement) *dynamodb.GlobalSecondaryIndex {
	return &dynamodb.GlobalSecondaryIndex{
		IndexName:  aws.String(name),
		KeySchema:  keys,
		Projection: &dynamodb.Projection{ProjectionType: aws.String("ALL")},
	}
}

// authorIndex lists a member's rows newest first ("my posts").
func authorIndex() *dynamodb.GlobalSecondaryIndex {
	return index("AuthorIndex", hashRangeKey("AuthorId", "CreatedAt"))
}
