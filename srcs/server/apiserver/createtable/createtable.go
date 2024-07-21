package createtable

import (
	"fmt"
	"log"
	"os"

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
			log.Fatalf("Got error calling CreateTable: %s", err)
		}

		fmt.Printf("Created the table %s\n", table.name)
	}
}
