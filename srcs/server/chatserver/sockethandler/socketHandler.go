package sockethandler

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"local.com/cors"
	"local.com/dynamo"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = pongWait * 9 / 10
	maxFrameBytes  = 8 << 10
	maxMessageRune = 1000
)

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

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
// Timestamp is in milliseconds (older rows are in seconds; clients
// treat values below 1e12 as seconds).
type ChatMessage struct {
	MessageId string `json:"MessageId"`
	ChatId    string `json:"ChatId"`
	UserId    string `json:"UserId"`
	Timestamp int64  `json:"Timestamp"`
	Content   string `json:"Content"`
}

// IsParticipant checks the user belongs to the chat room.
func IsParticipant(chatId, userId string) (bool, error) {
	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableChatRooms),
		Key:                  dynamo.Item{"ChatId": {S: aws.String(chatId)}},
		ProjectionExpression: aws.String("UserSeller, UserBuyer"),
	})
	if err != nil || result.Item == nil {
		return false, err
	}
	return dynamo.S(result.Item, "UserSeller") == userId || dynamo.S(result.Item, "UserBuyer") == userId, nil
}

func storeMessage(msg ChatMessage) error {
	_, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String(dynamo.TableChatMessage),
		Item: dynamo.Item{
			"MessageId": {S: aws.String(msg.MessageId)},
			"ChatId":    {S: aws.String(msg.ChatId)},
			"UserId":    {S: aws.String(msg.UserId)},
			"Timestamp": {N: aws.String(strconv.FormatInt(msg.Timestamp, 10))},
			"Content":   {S: aws.String(msg.Content)},
		},
	})
	return err
}

// Sockethandler upgrades the connection, joins the room hub and
// broadcasts each stored message. Must be wrapped with jwt.Middleware.
func Sockethandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())
	chatId := mux.Vars(r)["ChatId"]

	member, err := IsParticipant(chatId, userId)
	if err != nil {
		log.Printf("participant check failed: %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if !member {
		http.Error(w, "not a member of this chat room", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("websocket upgrade failed:", err)
		return
	}

	c := newClient(chatId)
	hub.Join(c)
	go writePump(conn, c)
	readPump(conn, c, userId)
}

// readPump owns reads; on exit it leaves the hub, which stops writePump.
func readPump(conn *websocket.Conn, c *Client, userId string) {
	defer func() {
		hub.Leave(c)
		conn.Close()
	}()

	conn.SetReadLimit(maxFrameBytes)
	conn.SetReadDeadline(time.Now().Add(pongWait))
	conn.SetPongHandler(func(string) error {
		return conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			return
		}

		var in inboundMessage
		if err := json.Unmarshal(raw, &in); err != nil {
			continue
		}
		content := strings.TrimSpace(in.Message)
		if content == "" || utf8.RuneCountInString(content) > maxMessageRune {
			continue
		}

		msg := ChatMessage{
			MessageId: uuid.NewString(),
			ChatId:    c.chatId,
			UserId:    userId,
			Timestamp: time.Now().UnixMilli(),
			Content:   content,
		}
		if err := storeMessage(msg); err != nil {
			log.Println("failed to store message:", err)
			continue
		}

		payload, _ := json.Marshal(msg)
		hub.Broadcast(c.chatId, payload)
	}
}

// writePump is the only writer of conn.
func writePump(conn *websocket.Conn, c *Client) {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		conn.Close()
	}()

	for {
		select {
		case payload, ok := <-c.send:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				conn.WriteMessage(websocket.CloseMessage, nil)
				return
			}
			if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
				return
			}
		case <-ticker.C:
			conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
