package main

import (
    "fmt"
    "log"
    "net/http"
    "os"

    "github.com/gorilla/mux"
    "github.com/aws/aws-sdk-go/aws"
    "github.com/aws/aws-sdk-go/aws/session"
    "github.com/aws/aws-sdk-go/aws/credentials"
    "github.com/aws/aws-sdk-go/service/dynamodb"
    "github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
)

type Item struct {
    ID   string `json:"id" dynamodbav:"ID"`
    Name string `json:"name" dynamodbav:"Name"`
}

func main() {
    router := mux.NewRouter()

    router.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        fmt.Fprintln(w, "Hello, world!")
    })

    router.HandleFunc("/create-table", func(w http.ResponseWriter, r *http.Request) {
        sess := session.Must(session.NewSession(&aws.Config{
            Region:      aws.String(os.Getenv("AWS_REGION")),
            Endpoint:    aws.String(os.Getenv("DYNAMODB_ENDPOINT")),
            Credentials: credentials.NewStaticCredentials(
                os.Getenv("AWS_ACCESS_KEY_ID"),
                os.Getenv("AWS_SECRET_ACCESS_KEY"),
                "",
            ),
        }))

        svc := dynamodb.New(sess)

        input := &dynamodb.CreateTableInput{
            TableName: aws.String("TestTable"),
            KeySchema: []*dynamodb.KeySchemaElement{
                {
                    AttributeName: aws.String("ID"),
                    KeyType:       aws.String("HASH"),
                },
            },
            AttributeDefinitions: []*dynamodb.AttributeDefinition{
                {
                    AttributeName: aws.String("ID"),
                    AttributeType: aws.String("S"),
                },
            },
            ProvisionedThroughput: &dynamodb.ProvisionedThroughput{
                ReadCapacityUnits:  aws.Int64(5),
                WriteCapacityUnits: aws.Int64(5),
            },
        }

        _, err := svc.CreateTable(input)
        if err != nil {
            log.Fatalf("Got error calling CreateTable: %s", err)
        }

        fmt.Fprintln(w, "Created the table TestTable")
    })

    router.HandleFunc("/table-list", func(w http.ResponseWriter, r *http.Request) {
        sess := session.Must(session.NewSession(&aws.Config{
        Region:      aws.String(os.Getenv("AWS_REGION")),
        Endpoint:    aws.String(os.Getenv("DYNAMODB_ENDPOINT")),
        Credentials: credentials.NewStaticCredentials(
            os.Getenv("AWS_ACCESS_KEY_ID"),
            os.Getenv("AWS_SECRET_ACCESS_KEY"),
            "",
        ),
    }))

    svc := dynamodb.New(sess)

    input := &dynamodb.DescribeTableInput{
        TableName: aws.String("TestTable"),
    }

    result, err := svc.DescribeTable(input)
    if err != nil {
        log.Fatalf("Got error describing table: %s", err)
    }

    fmt.Printf("Table description: %v\n", result)
    })

    router.HandleFunc("/add-item", func(w http.ResponseWriter, r *http.Request) {
        sess := session.Must(session.NewSession(&aws.Config{
            Region:      aws.String(os.Getenv("AWS_REGION")),
            Endpoint:    aws.String(os.Getenv("DYNAMODB_ENDPOINT")),
            Credentials: credentials.NewStaticCredentials(
                os.Getenv("AWS_ACCESS_KEY_ID"),
                os.Getenv("AWS_SECRET_ACCESS_KEY"),
                "",
            ),
        }))

        svc := dynamodb.New(sess)

        item := Item{
            ID:   "123",
            Name: "Test Item",
        }

        av, err := dynamodbattribute.MarshalMap(item)
        if err != nil {
            log.Fatalf("Got error marshalling new item: %s", err)
        }

        log.Printf("item: %v", av)

        input := &dynamodb.PutItemInput{
            TableName: aws.String("TestTable"),
            Item:      av,
        }

        _, err = svc.PutItem(input)
        if err != nil {
            log.Printf("PutItem input: %v", input)
            log.Fatalf("Got error calling PutItem: %s", err)
        }

        fmt.Fprintln(w, "Successfully added item to TestTable")
    })

    router.HandleFunc("/get-item", func(w http.ResponseWriter, r *http.Request) {
        sess := session.Must(session.NewSession(&aws.Config{
            Region:      aws.String(os.Getenv("AWS_REGION")),
            Endpoint:    aws.String(os.Getenv("DYNAMODB_ENDPOINT")),
            Credentials: credentials.NewStaticCredentials(
                os.Getenv("AWS_ACCESS_KEY_ID"),
                os.Getenv("AWS_SECRET_ACCESS_KEY"),
                "",
            ),
        }))

        svc := dynamodb.New(sess)

        result, err := svc.GetItem(&dynamodb.GetItemInput{
            TableName: aws.String("TestTable"),
            Key: map[string]*dynamodb.AttributeValue{
                "ID": {
                    S: aws.String("123"),
                },
            },
        })

        if err != nil {
            log.Fatalf("Got error calling GetItem: %s", err)
        }

        if result.Item == nil {
            fmt.Fprintln(w, "Could not find item with ID 123")
            return
        }

        item := Item{}
        err = dynamodbattribute.UnmarshalMap(result.Item, &item)
        if err != nil {
            log.Fatalf("Failed to unmarshal Record, %v", err)
        }

        fmt.Fprintf(w, "Found item: %s - %s\n", item.ID, item.Name)
    })

    log.Fatal(http.ListenAndServe(":8080", router))
}
