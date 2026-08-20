package main

import (
	"fmt"
	"net/http"
	"sort"
	"time"

	"chatserver/sockethandler"

	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

type ChatRoom struct {
	ChatId     string `json:"ChatId"`
	ProductId  string `json:"ProductId"`
	UserSeller string `json:"UserSeller"`
	UserBuyer  string `json:"UserBuyer"`
	CreatedAt  int64  `json:"CreatedAt"`
}

func userIdFromContext(r *http.Request) (string, bool) {
	claims, ok := r.Context().Value("claims").(*jwt.Claims)
	if !ok {
		return "", false
	}
	return claims.Username, true
}

// getOrCreateRoomHandler returns the buyer's chat room for a product,
// creating it on first contact. Must be wrapped with jwt.Middleware.
func getOrCreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	buyerId, ok := userIdFromContext(r)
	if !ok {
		jsonresponse.New(w, http.StatusUnauthorized, map[string]string{"error": "no session"})
		return
	}
	productId := mux.Vars(r)["productId"]

	// MVP: scan for the existing room; replace with a GSI query after
	// cloud migration.
	scan, err := svc.Scan(&dynamodb.ScanInput{
		TableName:        aws.String("ChatRooms"),
		FilterExpression: aws.String("ProductId = :p AND UserBuyer = :b"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":p": {S: aws.String(productId)},
			":b": {S: aws.String(buyerId)},
		},
	})
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if len(scan.Items) > 0 {
		var room ChatRoom
		if err := dynamodbattribute.UnmarshalMap(scan.Items[0], &room); err == nil {
			jsonresponse.New(w, http.StatusOK, room)
			return
		}
	}

	product, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String("Product"),
		Key: map[string]*dynamodb.AttributeValue{
			"ProductId": {S: aws.String(productId)},
		},
		ProjectionExpression: aws.String("UserId"),
	})
	if err != nil || product.Item == nil || product.Item["UserId"] == nil || product.Item["UserId"].S == nil {
		jsonresponse.New(w, http.StatusNotFound, map[string]string{"error": "product not found"})
		return
	}
	sellerId := *product.Item["UserId"].S
	if sellerId == buyerId {
		jsonresponse.New(w, http.StatusBadRequest, map[string]string{"error": "cannot chat about your own product"})
		return
	}

	room := ChatRoom{
		ChatId:     uuid.NewString(),
		ProductId:  productId,
		UserSeller: sellerId,
		UserBuyer:  buyerId,
		CreatedAt:  time.Now().Unix(),
	}
	_, err = svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String("ChatRooms"),
		Item: map[string]*dynamodb.AttributeValue{
			"ChatId":     {S: aws.String(room.ChatId)},
			"ProductId":  {S: aws.String(room.ProductId)},
			"UserSeller": {S: aws.String(room.UserSeller)},
			"UserBuyer":  {S: aws.String(room.UserBuyer)},
			"CreatedAt":  {N: aws.String(fmt.Sprintf("%d", room.CreatedAt))},
		},
	})
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	jsonresponse.New(w, http.StatusCreated, room)
}

// roomsHandler lists every chat room the user participates in.
func roomsHandler(w http.ResponseWriter, r *http.Request) {
	userId, ok := userIdFromContext(r)
	if !ok {
		jsonresponse.New(w, http.StatusUnauthorized, map[string]string{"error": "no session"})
		return
	}

	scan, err := svc.Scan(&dynamodb.ScanInput{
		TableName:        aws.String("ChatRooms"),
		FilterExpression: aws.String("UserSeller = :u OR UserBuyer = :u"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":u": {S: aws.String(userId)},
		},
	})
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	rooms := []ChatRoom{}
	if err := dynamodbattribute.UnmarshalListOfMaps(scan.Items, &rooms); err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	sort.Slice(rooms, func(i, j int) bool { return rooms[i].CreatedAt > rooms[j].CreatedAt })
	jsonresponse.New(w, http.StatusOK, rooms)
}

// historyHandler returns a room's messages, oldest first.
func historyHandler(w http.ResponseWriter, r *http.Request) {
	userId, ok := userIdFromContext(r)
	if !ok {
		jsonresponse.New(w, http.StatusUnauthorized, map[string]string{"error": "no session"})
		return
	}
	chatId := mux.Vars(r)["chatId"]

	room, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String("ChatRooms"),
		Key: map[string]*dynamodb.AttributeValue{
			"ChatId": {S: aws.String(chatId)},
		},
	})
	if err != nil || room.Item == nil {
		jsonresponse.New(w, http.StatusNotFound, map[string]string{"error": "chat room not found"})
		return
	}
	member := false
	for _, k := range []string{"UserSeller", "UserBuyer"} {
		if v := room.Item[k]; v != nil && v.S != nil && *v.S == userId {
			member = true
		}
	}
	if !member {
		jsonresponse.New(w, http.StatusForbidden, map[string]string{"error": "not a member of this chat room"})
		return
	}

	// MVP: scan filtered by ChatId; replace with a GSI query after
	// cloud migration.
	scan, err := svc.Scan(&dynamodb.ScanInput{
		TableName:        aws.String("ChatMessage"),
		FilterExpression: aws.String("ChatId = :c"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":c": {S: aws.String(chatId)},
		},
	})
	if err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	messages := []sockethandler.ChatMessage{}
	if err := dynamodbattribute.UnmarshalListOfMaps(scan.Items, &messages); err != nil {
		jsonresponse.New(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	sort.Slice(messages, func(i, j int) bool { return messages[i].Timestamp < messages[j].Timestamp })
	jsonresponse.New(w, http.StatusOK, messages)
}
