package main

import (
	"fmt"
	"net/http"
	"sort"
	"time"

	"local.com/jwt"
	"local.com/jsonresponse"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

func getchathandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	productid := vars["productId"]

	input := &dynamodb.GetItemInput{
		TableName: aws.String("Product"),
		Key: map[string]*dynamodb.AttributeValue{
			"ProductId": {
				S: aws.String(productid),
			},
		},
		ProjectionExpression: aws.String("UserId"),
	}

	result, err := svc.GetItem(input)
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	claims, ok := r.Context().Value("claims").(*jwt.Claims)
	if !ok {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": "No claims found in context"})
		return
	}

	tableName := "ChatRooms"
	chatId := uuid.NewString()
	messageId := uuid.NewString()
	item := map[string]*dynamodb.AttributeValue{
		"ChatId":     {S: aws.String(chatId)},
		"UserSeller": {S: aws.String(*result.Item["UserId"].S)},
		"UserBuyer":  {S: aws.String(claims.Username)},
		"MessageId":  {S: aws.String(messageId)},
	}

	putinput := &dynamodb.PutItemInput{
		TableName: aws.String(tableName),
		Item:      item,
	}

	_, err = svc.PutItem(putinput)
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Failed to put item in chatrooms: %s", err.Error())})
		return
	}

	tableName = "ChatMessage"
	item = map[string]*dynamodb.AttributeValue{
		"MessageId": {S: aws.String(messageId)},
		"Timestamp": {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
		"Content":   {S: aws.String("")},
	}

	putinput = &dynamodb.PutItemInput{
		TableName: aws.String(tableName),
		Item:      item,
	}

	_, err = svc.PutItem(putinput)
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Failed to put item in chatmessage: %s", err.Error())})
		return
	}

	jsonresponse.New(w, http.StatusCreated, map[string]string{"message": fmt.Sprintf("chat created, ChatId: %s, MessageId: %s", chatId, messageId)})
}

type ChatMessage struct {
	MessageId string `json:"MessageId"`
	Timestamp int64  `json:"Timestamp"`
	Content   string `json:"Content"`
}

func joinchathandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	chatId := vars["str"]

	chatRoomInput := &dynamodb.GetItemInput{
		TableName: aws.String("ChatRooms"),
		Key: map[string]*dynamodb.AttributeValue{
			"ChatId": {S: aws.String(chatId)},
		},
		ProjectionExpression: aws.String("MessageId"),
	}

	chatRoomResult, err := svc.GetItem(chatRoomInput)
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Failed to get item from ChatRooms: %s", err.Error())})
		return
	}

	if chatRoomResult.Item == nil {
		jsonresponse.New(w, http.StatusNotFound, map[string]string{"error": "Chat room not found"})
		return
	}

	messageId := chatRoomResult.Item["MessageId"].S

	chatMessageInput := &dynamodb.QueryInput{
		TableName:              aws.String("ChatMessage"),
		IndexName:              aws.String("TimestampIndex"),
		KeyConditionExpression: aws.String("MessageId = :messageId"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":messageId": {S: messageId},
		},
	}

	chatMessageResult, err := svc.Query(chatMessageInput)
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Failed to query chat messages: %s", err.Error())})
		return
	}

	if len(chatMessageResult.Items) == 0 {
		jsonresponse.New(w, http.StatusNotFound, map[string]string{"error": "No messages found for this chat room"})
		return
	}

	var messages []ChatMessage
	err = dynamodbattribute.UnmarshalListOfMaps(chatMessageResult.Items, &messages)
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": fmt.Sprintf("Failed to unmarshal chat messages: %s", err.Error())})
		return
	}

	sort.Slice(messages, func(i, j int) bool {
		return messages[i].Timestamp < messages[j].Timestamp
	})

	jsonresponse.New(w, http.StatusOK, messages)
}
