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

// ChatRoom links a member (UserBuyer, who started the conversation) with
// the owner of a subject (UserSeller). Rooms from before subjects have no
// SubjectType and are product rooms; ProductId stays filled for product
// rooms so older clients keep working.
type ChatRoom struct {
	ChatId      string `json:"ChatId"`
	SubjectType string `json:"SubjectType"`
	SubjectId   string `json:"SubjectId"`
	ProductId   string `json:"ProductId,omitempty"`
	UserSeller  string `json:"UserSeller"`
	UserBuyer   string `json:"UserBuyer"`
	CreatedAt   int64  `json:"CreatedAt"`
}

// normalize fills the subject of legacy product rooms.
func (r *ChatRoom) normalize() {
	if r.SubjectType == "" {
		r.SubjectType = SubjectProduct
		r.SubjectId = r.ProductId
	}
}

// RoomView adds what the UI shows instead of raw ids. Subject* is the
// generic title/picture/status; Product* repeats it for product rooms.
type RoomView struct {
	ChatRoom
	SubjectTitle   string `json:"SubjectTitle"`
	SubjectImage   string `json:"SubjectImage"`
	SubjectStatus  string `json:"SubjectStatus"`
	ProductName    string `json:"ProductName,omitempty"`
	ProductImage   string `json:"ProductImage,omitempty"`
	ProductStatus  string `json:"ProductStatus,omitempty"`
	SellerNickname string `json:"SellerNickname"`
	BuyerNickname  string `json:"BuyerNickname"`
}

// roomNamespace derives one stable ChatId per (subject, buyer) so a
// conditional put prevents duplicate rooms.
var roomNamespace = uuid.MustParse("6f1c1b8e-6a53-4c1e-9d0e-2f7a1f3e5c11")

// roomId keeps the original product formula, so existing product rooms
// are found again; other subjects are prefixed with their type.
func roomId(subjectType, subjectId, buyerId string) string {
	name := subjectId + ":" + buyerId
	if subjectType != SubjectProduct {
		name = subjectType + ":" + name
	}
	return uuid.NewSHA1(roomNamespace, []byte(name)).String()
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
	room.normalize()
	return &room, nil
}

// findLegacyRoom finds product rooms created before deterministic ids.
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
	room.normalize()
	return &room, nil
}

// enrich fills subject and nickname fields with one batch read per
// subject table plus one for users.
func enrich(rooms []ChatRoom) ([]RoomView, error) {
	idsByTable := map[string][]string{}
	var userIds []string
	for _, r := range rooms {
		kind := subjects[r.SubjectType]
		idsByTable[kind.table] = append(idsByTable[kind.table], r.SubjectId)
		userIds = append(userIds, r.UserSeller, r.UserBuyer)
	}
	found := map[string]map[string]dynamo.Item{}
	for table, ids := range idsByTable {
		if table == "" {
			continue
		}
		// Post attributes include reserved words (Status, Type), which a
		// batch projection cannot alias, so posts are read whole.
		projection := ""
		if table == dynamo.TableProduct {
			projection = "ProductId, ProductName, ProductImage, ProductStatus"
		}
		items, err := dynamo.BatchGet(svc, table, keyOf(table), ids, projection)
		if err != nil {
			return nil, err
		}
		found[table] = items
	}
	users, err := dynamo.BatchGet(svc, dynamo.TableUsers, "UserId", userIds, "UserId, UserNickname")
	if err != nil {
		return nil, err
	}

	views := make([]RoomView, 0, len(rooms))
	for _, r := range rooms {
		v := RoomView{ChatRoom: r}
		kind := subjects[r.SubjectType]
		if item, ok := found[kind.table][r.SubjectId]; ok {
			v.SubjectTitle = dynamo.S(item, kind.title)
			v.SubjectStatus = dynamo.S(item, kind.status)
			v.SubjectImage = firstImage(item, kind.image)
		}
		if r.SubjectType == SubjectProduct {
			v.ProductName, v.ProductImage, v.ProductStatus = v.SubjectTitle, v.SubjectImage, v.SubjectStatus
		}
		v.SellerNickname = dynamo.S(users[r.UserSeller], "UserNickname")
		v.BuyerNickname = dynamo.S(users[r.UserBuyer], "UserNickname")
		views = append(views, v)
	}
	return views, nil
}

func keyOf(table string) string {
	for _, k := range subjects {
		if k.table == table {
			return k.key
		}
	}
	return ""
}

func isMember(room *ChatRoom, userId string) bool {
	return room.UserSeller == userId || room.UserBuyer == userId
}

// getOrCreateRoomHandler returns the member's chat room about a subject
// (/room/{subjectType}/{subjectId}), creating it on first contact. Must
// be wrapped with jwt.Middleware and account.RequireActive.
func getOrCreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	buyerId := jwt.UserID(r.Context())
	subjectType := mux.Vars(r)["subjectType"]
	subjectId := mux.Vars(r)["subjectId"]
	kind, ok := subjects[subjectType]
	if !ok {
		jsonresponse.Error(w, http.StatusNotFound, "알 수 없는 채팅 대상이에요.")
		return
	}
	chatId := roomId(subjectType, subjectId, buyerId)

	room, err := getRoom(chatId)
	if err == nil && room == nil && subjectType == SubjectProduct {
		room, err = findLegacyRoom(subjectId, buyerId)
	}
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if room != nil {
		jsonresponse.New(w, http.StatusOK, room)
		return
	}

	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(kind.table),
		Key:       dynamo.Item{kind.key: {S: aws.String(subjectId)}},
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	sellerId := dynamo.S(out.Item, kind.owner)
	if sellerId == "" || (kind.postType != "" && dynamo.S(out.Item, "Type") != kind.postType) {
		jsonresponse.Error(w, http.StatusNotFound, kind.notFound)
		return
	}
	if sellerId == buyerId {
		jsonresponse.Error(w, http.StatusBadRequest, kind.ownSelf)
		return
	}
	if kind.closedMsg != "" && dynamo.S(out.Item, kind.status) != "active" {
		jsonresponse.Error(w, http.StatusConflict, kind.closedMsg)
		return
	}

	newRoom := ChatRoom{
		ChatId:      chatId,
		SubjectType: subjectType,
		SubjectId:   subjectId,
		UserSeller:  sellerId,
		UserBuyer:   buyerId,
		CreatedAt:   time.Now().Unix(),
	}
	item := dynamo.Item{
		"ChatId":      {S: aws.String(newRoom.ChatId)},
		"SubjectType": {S: aws.String(subjectType)},
		"SubjectId":   {S: aws.String(subjectId)},
		"UserSeller":  {S: aws.String(newRoom.UserSeller)},
		"UserBuyer":   {S: aws.String(newRoom.UserBuyer)},
		"CreatedAt":   {N: aws.String(strconv.FormatInt(newRoom.CreatedAt, 10))},
	}
	if subjectType == SubjectProduct {
		newRoom.ProductId = subjectId
		item["ProductId"] = &dynamodb.AttributeValue{S: aws.String(subjectId)}
	}
	_, err = svc.PutItem(&dynamodb.PutItemInput{
		TableName:           aws.String(dynamo.TableChatRooms),
		Item:                item,
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
	for i := range rooms {
		rooms[i].normalize()
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
