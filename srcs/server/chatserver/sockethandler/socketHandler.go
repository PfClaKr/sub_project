package sockethandler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

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
		return true
	},
}

type Message struct {
	UserId  string `json:"UserId"`
	Message string `json:"Message"`
}

func Sockethandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Println("Failed to upgrade to websocket:", err)
		http.Error(w, fmt.Sprintf("Failed to upgrade to websocket: %s", err.Error()), http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	vars := mux.Vars(r)
	chatId := vars["ChatId"]

	input := &dynamodb.GetItemInput{
		TableName: aws.String("ChatRooms"),
		Key: map[string]*dynamodb.AttributeValue{
			"ChatId": {
				S: aws.String(chatId),
			},
		},
	}

	result, err := svc.GetItem(input)
	if err != nil {
		fmt.Println("Error fetching ChatId:", err)
		conn.WriteMessage(websocket.TextMessage, []byte("Error fetching ChatId"))
		return
	}

	if result.Item == nil {
		fmt.Println("ChatId not found")
		conn.WriteMessage(websocket.TextMessage, []byte("ChatId not found"))
		return
	}

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			fmt.Println("Failed to read websocket message:", err)
			return
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			fmt.Println("Failed to unmarshal message:", err)
			conn.WriteMessage(websocket.TextMessage, []byte("Failed to unmarshal message"))
			continue
		}

		messageId := uuid.NewString()

		item := map[string]*dynamodb.AttributeValue{
			"MessageId": {
				S: aws.String(messageId),
			},
			"ChatId": {
				S: aws.String(chatId),
			},
			"UserId": {
				S: aws.String(msg.UserId),
			},
			"Timestamp": {
				N: aws.String(fmt.Sprintf("%d", time.Now().Unix())),
			},
			"Content": {
				S: aws.String(msg.Message),
			},
		}

		putInput := &dynamodb.PutItemInput{
			TableName: aws.String("ChatMessage"),
			Item:      item,
		}

		_, err = svc.PutItem(putInput)
		if err != nil {
			fmt.Println("Failed to put item in chatmessage:", err)
			conn.WriteMessage(websocket.TextMessage, []byte("Failed to store message"))
			continue
		}

		conn.WriteMessage(websocket.TextMessage, []byte("Message stored successfully"))
	}
}
