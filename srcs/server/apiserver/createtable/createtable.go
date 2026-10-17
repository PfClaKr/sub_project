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

// CreateTables creates missing tables, waiting for DynamoDB to come up.
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

	tables := []struct {
		name    string
		schema  []*dynamodb.KeySchemaElement
		attribs []*dynamodb.AttributeDefinition
		indexes []*dynamodb.GlobalSecondaryIndex
		ttl     string // attribute DynamoDB expires rows by (epoch seconds)
	}{
		{
			name: "Users",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("UserId"), KeyType: aws.String("HASH")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("UserId"), AttributeType: aws.String("S")},
				{AttributeName: aws.String("Email"), AttributeType: aws.String("S")},
			},
			indexes: []*dynamodb.GlobalSecondaryIndex{
				{
					IndexName: aws.String("UserEmailIndex"),
					KeySchema: []*dynamodb.KeySchemaElement{
						{AttributeName: aws.String("Email"), KeyType: aws.String("HASH")},
						{AttributeName: aws.String("UserId"), KeyType: aws.String("RANGE")},
					},
					Projection: &dynamodb.Projection{
						ProjectionType: aws.String("ALL"),
					},
				},
			},
		},
		{
			name: "UsersCredential",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("Email"), KeyType: aws.String("HASH")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("Email"), AttributeType: aws.String("S")},
			},
		},
		{
			name: "Product",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("ProductId"), KeyType: aws.String("HASH")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("ProductId"), AttributeType: aws.String("S")},
				{AttributeName: aws.String("ProductName"), AttributeType: aws.String("S")},
			},
			indexes: []*dynamodb.GlobalSecondaryIndex{
				{
					IndexName: aws.String("ProductNameIndex"),
					KeySchema: []*dynamodb.KeySchemaElement{
						{AttributeName: aws.String("ProductName"), KeyType: aws.String("HASH")},
						{AttributeName: aws.String("ProductId"), KeyType: aws.String("RANGE")},
					},
					Projection: &dynamodb.Projection{
						ProjectionType: aws.String("ALL"),
					},
				},
			},
		},
		{
			name: "Favorites",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("UserId"), KeyType: aws.String("HASH")},
				{AttributeName: aws.String("ItemId"), KeyType: aws.String("RANGE")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("UserId"), AttributeType: aws.String("S")},
				{AttributeName: aws.String("ItemId"), AttributeType: aws.String("S")},
			},
		},
		{
			name: "ChatRooms",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("ChatId"), KeyType: aws.String("HASH")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("ChatId"), AttributeType: aws.String("S")},
			},
		},
		{
			// Town / arrondissement boundaries cached from OpenStreetMap.
			name: "GeoAreas",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("AreaId"), KeyType: aws.String("HASH")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("AreaId"), AttributeType: aws.String("S")},
			},
		},
		{
			name: "ChatMessage",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("MessageId"), KeyType: aws.String("HASH")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("MessageId"), AttributeType: aws.String("S")},
				{AttributeName: aws.String("Timestamp"), AttributeType: aws.String("N")}, // Timestamp 추가
			},
			indexes: []*dynamodb.GlobalSecondaryIndex{
				{
					IndexName: aws.String("TimestampIndex"),
					KeySchema: []*dynamodb.KeySchemaElement{
						{AttributeName: aws.String("Timestamp"), KeyType: aws.String("HASH")},
						{AttributeName: aws.String("MessageId"), KeyType: aws.String("RANGE")}, // Range key 추가
					},
					Projection: &dynamodb.Projection{
						ProjectionType: aws.String("ALL"),
					},
				},
			},
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
			name:    dynamo.TableNotifications,
			schema:  hashRangeKey("UserId", "SortKey"),
			attribs: []*dynamodb.AttributeDefinition{attr("UserId", "S"), attr("SortKey", "S")},
			ttl:     "ExpiresAt",
		},
	}

	for _, table := range tables {
		input := &dynamodb.CreateTableInput{
			TableName:            aws.String(table.name),
			KeySchema:            table.schema,
			AttributeDefinitions: table.attribs,
			// On-demand: nothing is billed while idle, and full scans
			// (listings, reindex) are never throttled by a small quota.
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
		if table.ttl != "" {
			enableTTL(svc, table.name, table.ttl)
		}
	}
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

// authorIndex lists a member's rows newest first ("my posts").
func authorIndex() *dynamodb.GlobalSecondaryIndex {
	return &dynamodb.GlobalSecondaryIndex{
		IndexName:  aws.String("AuthorIndex"),
		KeySchema:  hashRangeKey("AuthorId", "CreatedAt"),
		Projection: &dynamodb.Projection{ProjectionType: aws.String("ALL")},
	}
}
