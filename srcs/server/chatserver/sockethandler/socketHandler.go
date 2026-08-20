package sockethandler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"local.com/cors"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/google/uuid"
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

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		// Empty origin means a non-browser client (e.g. tests).
		return origin == "" || cors.IsAllowedOrigin(origin)
	},
}

type inboundMessage struct {
	Message string `json:"Message"`
}

// ChatMessage is the payload stored and broadcast to room members.
type ChatMessage struct {
	MessageId string `json:"MessageId"`
	ChatId    string `json:"ChatId"`
	UserId    string `json:"UserId"`
	Timestamp int64  `json:"Timestamp"`
	Content   string `json:"Content"`
}

// isParticipant checks the user belongs to the chat room.
func isParticipant(chatId, userId string) bool {
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String("ChatRooms"),
		Key: map[string]*dynamodb.AttributeValue{
			"ChatId": {S: aws.String(chatId)},
		},
		ProjectionExpression: aws.String("UserSeller, UserBuyer"),
	})
	if err != nil || result.Item == nil {
		return false
	}
	for _, k := range []string{"UserSeller", "UserBuyer"} {
		if v := result.Item[k]; v != nil && v.S != nil && *v.S == userId {
			return true
		}
	}
	return false
}

func storeMessage(msg ChatMessage) error {
	_, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String("ChatMessage"),
		Item: map[string]*dynamodb.AttributeValue{
			"MessageId": {S: aws.String(msg.MessageId)},
			"ChatId":    {S: aws.String(msg.ChatId)},
			"UserId":    {S: aws.String(msg.UserId)},
			"Timestamp": {N: aws.String(fmt.Sprintf("%d", msg.Timestamp))},
			"Content":   {S: aws.String(msg.Content)},
		},
	})
	return err
}

// Sockethandler upgrades the connection, joins the room hub and
// broadcasts each stored message. Must be wrapped with jwt.Middleware.
func Sockethandler(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value("claims").(*jwt.Claims)
	if !ok {
		http.Error(w, "no session", http.StatusUnauthorized)
		return
	}
	userId := claims.Username

	chatId := mux.Vars(r)["ChatId"]
	if !isParticipant(chatId, userId) {
		http.Error(w, "not a member of this chat room", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("Failed to upgrade to websocket:", err)
		return
	}

	hub.Join(chatId, conn)
	defer func() {
		hub.Leave(chatId, conn)
		conn.Close()
	}()

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			return
		}

		var in inboundMessage
		if err := json.Unmarshal(raw, &in); err != nil || in.Message == "" {
			continue
		}

		msg := ChatMessage{
			MessageId: uuid.NewString(),
			ChatId:    chatId,
			UserId:    userId,
			Timestamp: time.Now().Unix(),
			Content:   in.Message,
		}

		if err := storeMessage(msg); err != nil {
			fmt.Println("Failed to store message:", err)
			continue
		}

		payload, _ := json.Marshal(msg)
		hub.Broadcast(chatId, payload)
	}
}
