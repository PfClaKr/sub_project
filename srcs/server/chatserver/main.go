package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"chatserver/sockethandler"

	"local.com/cors"
	"local.com/jwt"

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
	r.Handle("/rooms", jwt.Middleware(http.HandlerFunc(roomsHandler))).Methods("GET")
	r.Handle("/room/product/{productId}", jwt.Middleware(http.HandlerFunc(getOrCreateRoomHandler))).Methods("GET")
	r.Handle("/history/{chatId}", jwt.Middleware(http.HandlerFunc(historyHandler))).Methods("GET")
	r.Handle("/ws/{ChatId}", jwt.Middleware(http.HandlerFunc(sockethandler.Sockethandler))).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "9090"
	}

	fmt.Println("Starting chat server on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, cors.Middleware(r)))
}
