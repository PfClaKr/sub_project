package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"local.com/createtable"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/gorilla/mux"
)

var svc dynamodbiface.DynamoDBAPI

func init() {
	sess := session.Must(session.NewSession(&aws.Config{
		Region:   aws.String(os.Getenv("AWS_REGION")),
		Endpoint: aws.String(os.Getenv("DYNAMODB_ENDPOINT")),
		Credentials: credentials.NewStaticCredentials(
			os.Getenv("AWS_ACCESS_KEY_ID"),
			os.Getenv("AWS_SECRET_ACCESS_KEY"),
			"",
		),
	}))
	svc = dynamodb.New(sess)
	createtable.CreateTables()
	initElasticsearch()
}

func listTables(w http.ResponseWriter, r *http.Request) {
	input := &dynamodb.ListTablesInput{}
	result, err := svc.ListTables(input)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(result.TableNames)
}

func describeTable(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tableName := vars["table"]

	// Scan the table
	input := &dynamodb.ScanInput{
		TableName: aws.String(tableName),
	}
	result, err := svc.Scan(input)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Convert the result to a more readable format
	readableItems := make([]map[string]interface{}, 0)

	for _, item := range result.Items {
		readableItem := make(map[string]interface{})
		for k, v := range item {
			switch {
			case v.S != nil:
				readableItem[k] = *v.S
			case v.N != nil:
				readableItem[k] = *v.N
			case v.SS != nil:
				readableItem[k] = v.SS
			case v.NS != nil:
				readableItem[k] = v.NS
			case v.BOOL != nil:
				readableItem[k] = *v.BOOL
			case v.L != nil:
				readableList := make([]interface{}, len(v.L))
				for i, lv := range v.L {
					switch {
					case lv.S != nil:
						readableList[i] = *lv.S
					case lv.N != nil:
						readableList[i] = *lv.N
					case lv.BOOL != nil:
						readableList[i] = *lv.BOOL
					}
				}
				readableItem[k] = readableList
			case v.M != nil:
				readableMap := make(map[string]interface{})
				for mk, mv := range v.M {
					switch {
					case mv.S != nil:
						readableMap[mk] = *mv.S
					case mv.N != nil:
						readableMap[mk] = *mv.N
					case mv.BOOL != nil:
						readableMap[mk] = *mv.BOOL
					}
				}
				readableItem[k] = readableMap
			}
		}
		readableItems = append(readableItems, readableItem)
	}

	json.NewEncoder(w).Encode(readableItems)
}

func main() {

	r := mux.NewRouter()
	r.HandleFunc("/tables", listTables).Methods("GET")
	r.HandleFunc("/tables/{table}", describeTable).Methods("GET")
	r.HandleFunc("/dummy/{count}", generateDummyData).Methods("GET")
	r.HandleFunc("/dummydelete", deleteDummyData).Methods("GET")
	r.HandleFunc("/graphql", graphqlHandler).Methods("POST")

	fmt.Println("Starting server on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
