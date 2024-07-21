package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"local.com/jwt"
	"chatserver/sockethandler"

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
}

func main() {

	r := mux.NewRouter()
	r.Handle("/getchatroom/{productId}", jwt.Middleware(http.HandlerFunc(getchathandler))).Methods("GET")
	r.HandleFunc("/joinchatroom/{str}", joinchathandler).Methods("GET")
	r.HandleFunc("/dummy/{count}", dummyhandler).Methods("GET")

	r.HandleFunc("/ws/{ChatId}", sockethandler.Sockethandler).Methods("GET", "POST")

	fmt.Println("Starting chat server on :9090")
	log.Fatal(http.ListenAndServe(":9090", r))
}
