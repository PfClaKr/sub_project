package createtable

import (
	"os"
	"fmt"
	"log"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

func CreateTables() {
	sess := session.Must(session.NewSession(&aws.Config{
		Region:   aws.String(os.Getenv("AWS_REGION")),        // DynamoDB Local은 아무 Region이나 사용해도 상관없습니다.
		Endpoint: aws.String(os.Getenv("DYNAMODB_ENDPOINT")), // DynamoDB Local의 기본 포트
		Credentials: credentials.NewStaticCredentials(
			os.Getenv("AWS_ACCESS_KEY_ID"),
			os.Getenv("AWS_SECRET_ACCESS_KEY"),
			"",
		),
	}))

	svc := dynamodb.New(sess)

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
			name: "Items",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("ItemId"), KeyType: aws.String("HASH")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("ItemId"), AttributeType: aws.String("S")},
				{AttributeName: aws.String("Title"), AttributeType: aws.String("S")},
			},
			indexes: []*dynamodb.GlobalSecondaryIndex{
				{
					IndexName: aws.String("ItemTitleIndex"),
					KeySchema: []*dynamodb.KeySchemaElement{
						{AttributeName: aws.String("Title"), KeyType: aws.String("HASH")},
						{AttributeName: aws.String("ItemId"), KeyType: aws.String("RANGE")},
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
			name: "ItemSearchIndex",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("Category"), KeyType: aws.String("HASH")},
				{AttributeName: aws.String("Price#Location"), KeyType: aws.String("RANGE")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("Category"), AttributeType: aws.String("S")},
				{AttributeName: aws.String("Price#Location"), AttributeType: aws.String("S")},
			},
		},
		{
			name: "Chats",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("ChatId"), KeyType: aws.String("HASH")},
				{AttributeName: aws.String("Timestamp"), KeyType: aws.String("RANGE")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("ChatId"), AttributeType: aws.String("S")},
				{AttributeName: aws.String("Timestamp"), AttributeType: aws.String("N")},
			},
		},
		{
			name: "ChatRooms",
			schema: []*dynamodb.KeySchemaElement{
				{AttributeName: aws.String("UserId"), KeyType: aws.String("HASH")},
				{AttributeName: aws.String("ChatId"), KeyType: aws.String("RANGE")},
			},
			attribs: []*dynamodb.AttributeDefinition{
				{AttributeName: aws.String("UserId"), AttributeType: aws.String("S")},
				{AttributeName: aws.String("ChatId"), AttributeType: aws.String("S")},
			},
			indexes: []*dynamodb.GlobalSecondaryIndex{
				{
					IndexName: aws.String("ChatUserIndex"),
					KeySchema: []*dynamodb.KeySchemaElement{
						{AttributeName: aws.String("UserId"), KeyType: aws.String("HASH")},
						{AttributeName: aws.String("ChatId"), KeyType: aws.String("RANGE")},
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
			log.Fatalf("Got error calling CreateTable: %s", err)
		}

		fmt.Printf("Created the table %s\n", table.name)
	}
}
