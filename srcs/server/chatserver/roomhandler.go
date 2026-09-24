package main

import (
	"net/http"
	"sort"
	"strconv"
	"time"

	"chatserver/sockethandler"

	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbattribute"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

type ChatRoom struct {
	ChatId     string `json:"ChatId"`
	ProductId  string `json:"ProductId"`
	UserSeller string `json:"UserSeller"`
	UserBuyer  string `json:"UserBuyer"`
	CreatedAt  int64  `json:"CreatedAt"`
}

// RoomView adds what the UI shows instead of raw ids.
type RoomView struct {
	ChatRoom
	ProductName    string `json:"ProductName"`
	ProductImage   string `json:"ProductImage"`
	ProductStatus  string `json:"ProductStatus"`
	SellerNickname string `json:"SellerNickname"`
	BuyerNickname  string `json:"BuyerNickname"`
}

// roomNamespace derives one stable ChatId per (product, buyer) so a
// conditional put prevents duplicate rooms.
var roomNamespace = uuid.MustParse("6f1c1b8e-6a53-4c1e-9d0e-2f7a1f3e5c11")

func roomId(productId, buyerId string) string {
	return uuid.NewSHA1(roomNamespace, []byte(productId+":"+buyerId)).String()
}

func getRoom(chatId string) (*ChatRoom, error) {
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableChatRooms),
		Key:       dynamo.Item{"ChatId": {S: aws.String(chatId)}},
	})
	if err != nil || result.Item == nil {
		return nil, err
	}
	var room ChatRoom
	if err := dynamodbattribute.UnmarshalMap(result.Item, &room); err != nil {
		return nil, err
	}
	return &room, nil
}

// findLegacyRoom finds rooms created before deterministic ids.
func findLegacyRoom(productId, buyerId string) (*ChatRoom, error) {
	items, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{
		TableName:        aws.String(dynamo.TableChatRooms),
		FilterExpression: aws.String("ProductId = :p AND UserBuyer = :b"),
		ExpressionAttributeValues: dynamo.Item{
			":p": {S: aws.String(productId)},
			":b": {S: aws.String(buyerId)},
		},
	})
	if err != nil || len(items) == 0 {
		return nil, err
	}
	var room ChatRoom
	if err := dynamodbattribute.UnmarshalMap(items[0], &room); err != nil {
		return nil, err
	}
	return &room, nil
}

// enrich fills product and nickname fields with two batch reads.
func enrich(rooms []ChatRoom) ([]RoomView, error) {
	var productIds, userIds []string
	for _, r := range rooms {
		productIds = append(productIds, r.ProductId)
		userIds = append(userIds, r.UserSeller, r.UserBuyer)
	}
	products, err := dynamo.BatchGet(svc, dynamo.TableProduct, "ProductId", productIds, "ProductId, ProductName, ProductImage, ProductStatus")
	if err != nil {
		return nil, err
	}
	users, err := dynamo.BatchGet(svc, dynamo.TableUsers, "UserId", userIds, "UserId, UserNickname")
	if err != nil {
		return nil, err
	}

	views := make([]RoomView, 0, len(rooms))
	for _, r := range rooms {
		v := RoomView{ChatRoom: r}
		if p, ok := products[r.ProductId]; ok {
			v.ProductName = dynamo.S(p, "ProductName")
			v.ProductStatus = dynamo.S(p, "ProductStatus")
			if img := p["ProductImage"]; img != nil && len(img.SS) > 0 {
				v.ProductImage = aws.StringValue(img.SS[0])
			}
		}
		v.SellerNickname = dynamo.S(users[r.UserSeller], "UserNickname")
		v.BuyerNickname = dynamo.S(users[r.UserBuyer], "UserNickname")
		views = append(views, v)
	}
	return views, nil
}

func isMember(room *ChatRoom, userId string) bool {
	return room.UserSeller == userId || room.UserBuyer == userId
}

// getOrCreateRoomHandler returns the buyer's chat room for a product,
// creating it on first contact. Must be wrapped with jwt.Middleware.
func getOrCreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	buyerId := jwt.UserID(r.Context())
	productId := mux.Vars(r)["productId"]
	chatId := roomId(productId, buyerId)

	room, err := getRoom(chatId)
	if err == nil && room == nil {
		room, err = findLegacyRoom(productId, buyerId)
	}
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if room != nil {
		jsonresponse.New(w, http.StatusOK, room)
		return
	}

	product, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableProduct),
		Key:                  dynamo.Item{"ProductId": {S: aws.String(productId)}},
		ProjectionExpression: aws.String("UserId"),
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	sellerId := dynamo.S(product.Item, "UserId")
	if sellerId == "" {
		jsonresponse.Error(w, http.StatusNotFound, "상품을 찾을 수 없어요.")
		return
	}
	if sellerId == buyerId {
		jsonresponse.Error(w, http.StatusBadRequest, "내 상품에는 채팅할 수 없어요.")
		return
	}

	newRoom := ChatRoom{
		ChatId:     chatId,
		ProductId:  productId,
		UserSeller: sellerId,
		UserBuyer:  buyerId,
		CreatedAt:  time.Now().Unix(),
	}
	_, err = svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String(dynamo.TableChatRooms),
		Item: dynamo.Item{
			"ChatId":     {S: aws.String(newRoom.ChatId)},
			"ProductId":  {S: aws.String(newRoom.ProductId)},
			"UserSeller": {S: aws.String(newRoom.UserSeller)},
			"UserBuyer":  {S: aws.String(newRoom.UserBuyer)},
			"CreatedAt":  {N: aws.String(strconv.FormatInt(newRoom.CreatedAt, 10))},
		},
		ConditionExpression: aws.String("attribute_not_exists(ChatId)"),
	})
	// A concurrent request created it first; that room is the same one.
	if aerr, ok := err.(awserr.Error); ok && aerr.Code() == dynamodb.ErrCodeConditionalCheckFailedException {
		jsonresponse.New(w, http.StatusOK, newRoom)
		return
	}
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusCreated, newRoom)
}

// roomHandler returns one room with display info, members only.
func roomHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())
	room, err := getRoom(mux.Vars(r)["chatId"])
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if room == nil || !isMember(room, userId) {
		jsonresponse.Error(w, http.StatusNotFound, "채팅방을 찾을 수 없어요.")
		return
	}
	views, err := enrich([]ChatRoom{*room})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, views[0])
}

// roomsHandler lists every chat room the user participates in.
// MVP: scan; replace with GSIs on UserSeller/UserBuyer later.
func roomsHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())

	items, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{
		TableName:                 aws.String(dynamo.TableChatRooms),
		FilterExpression:          aws.String("UserSeller = :u OR UserBuyer = :u"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(userId)}},
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}

	rooms := []ChatRoom{}
	if err := dynamodbattribute.UnmarshalListOfMaps(items, &rooms); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	sort.Slice(rooms, func(i, j int) bool { return rooms[i].CreatedAt > rooms[j].CreatedAt })

	views, err := enrich(rooms)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, views)
}

// historyHandler returns a room's messages, oldest first.
// MVP: scan filtered by ChatId; replace with a GSI query later.
func historyHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())
	chatId := mux.Vars(r)["chatId"]

	member, err := sockethandler.IsParticipant(chatId, userId)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if !member {
		jsonresponse.Error(w, http.StatusNotFound, "채팅방을 찾을 수 없어요.")
		return
	}

	items, err := dynamo.ScanAll(svc, &dynamodb.ScanInput{
		TableName:                 aws.String(dynamo.TableChatMessage),
		FilterExpression:          aws.String("ChatId = :c"),
		ExpressionAttributeValues: dynamo.Item{":c": {S: aws.String(chatId)}},
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}

	messages := []sockethandler.ChatMessage{}
	if err := dynamodbattribute.UnmarshalListOfMaps(items, &messages); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	// Normalize legacy second timestamps so ordering is consistent.
	for i := range messages {
		if messages[i].Timestamp < 1e12 {
			messages[i].Timestamp *= 1000
		}
	}
	sort.Slice(messages, func(i, j int) bool { return messages[i].Timestamp < messages[j].Timestamp })
	jsonresponse.New(w, http.StatusOK, messages)
}
