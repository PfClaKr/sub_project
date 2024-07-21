package main

import (
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"local.com/jsonresponse"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

func dummyhandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	countStr := vars["count"]
	count, err := strconv.Atoi(countStr)
	if err != nil {
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "Invalid count parameter"})
		return
	}
	for i := 0; i < count; i++ {
		messageId := uuid.New().String()

		chatRoomItem := map[string]*dynamodb.AttributeValue{
			"ChatId":    {S: aws.String(uuid.New().String())},
			"MessageId": {S: aws.String(messageId)},
		}
		_, err := svc.PutItem(&dynamodb.PutItemInput{
			TableName: aws.String("ChatRooms"),
			Item:      chatRoomItem,
		})
		if err != nil {
			jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "Failed to insert chat room"})
			return
		}

		for j := 0; j < 5; j++ {
			chatMessageItem := map[string]*dynamodb.AttributeValue{
				"MessageId": {S: aws.String(messageId)},
				"Timestamp": {N: aws.String(fmt.Sprintf("%d", time.Now().Add(time.Duration(rand.Intn(100))*time.Minute).Unix()))},
				"Content":   {S: aws.String(fmt.Sprintf("Dummy message %d", j+1))},
			}
			_, err := svc.PutItem(&dynamodb.PutItemInput{
				TableName: aws.String("ChatMessage"),
				Item:      chatMessageItem,
			})
			if err != nil {
				jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "Failed to insert chat message"})
				return
			}
		}
	}
	jsonresponse.New(w, http.StatusCreated, map[string]string{"message": "Chatroom created"})
}