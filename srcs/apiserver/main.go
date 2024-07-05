package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"local.com/createtable"
	"local.com/graphqlhandler"
	"local.com/jwt"
	"local.com/eshandler"
	"local.com/loginhandler"

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
	eshandler.InitElasticsearch()
}

func main() {

	r := mux.NewRouter()
	r.HandleFunc("/tables", listTables).Methods("GET")
	r.HandleFunc("/tables/{table}", describeTable).Methods("GET")
	r.HandleFunc("/dummy/{count}", generateDummyData).Methods("GET")
	r.HandleFunc("/dummydelete", deleteDummyData).Methods("GET")

	r.HandleFunc("/graphql", graphqlhandler.GraphqlHandler).Methods("POST")
	r.HandleFunc("/login", loginhandler.LoginHandler).Methods("POST")

	r.Handle("/testjwt", jwt.JwtMiddleware(http.HandlerFunc(jwt.Showjwt))).Methods("GET")

	fmt.Println("Starting server on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
