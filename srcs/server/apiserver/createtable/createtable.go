package createtable

import (
	"fmt"
	"log"
	"time"

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
					ProvisionedThroughput: &dynamodb.ProvisionedThroughput{
						ReadCapacityUnits:  aws.Int64(5),
						WriteCapacityUnits: aws.Int64(5),
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
					ProvisionedThroughput: &dynamodb.ProvisionedThroughput{
						ReadCapacityUnits:  aws.Int64(5),
						WriteCapacityUnits: aws.Int64(5),
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
					ProvisionedThroughput: &dynamodb.ProvisionedThroughput{
						ReadCapacityUnits:  aws.Int64(5),
						WriteCapacityUnits: aws.Int64(5),
					},
				},
			},
		},
	}

	for _, table := range tables {
		input := &dynamodb.CreateTableInput{
			TableName:            aws.String(table.name),
			KeySchema:            table.schema,
			AttributeDefinitions: table.attribs,
			ProvisionedThroughput: &dynamodb.ProvisionedThroughput{
				ReadCapacityUnits:  aws.Int64(5),
				WriteCapacityUnits: aws.Int64(5),
			},
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
}
