package favoriteshandler

import (
	"encoding/json"
	"net/http"
	"os"

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

func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(payload)
}

func userIdFromContext(r *http.Request) (string, bool) {
	claims, ok := r.Context().Value("claims").(*jwt.Claims)
	if !ok {
		return "", false
	}
	return claims.Username, true
}

// AddHandler saves a product to the user's favorites.
// All handlers here must be wrapped with jwt.Middleware.
func AddHandler(w http.ResponseWriter, r *http.Request) {
	userId, ok := userIdFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "no session"})
		return
	}
	productId := mux.Vars(r)["productId"]

	_, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String("Favorites"),
		Item: map[string]*dynamodb.AttributeValue{
			"UserId": {S: aws.String(userId)},
			"ItemId": {S: aws.String(productId)},
		},
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, map[string]bool{"favorited": true})
}

// RemoveHandler deletes a product from the user's favorites.
func RemoveHandler(w http.ResponseWriter, r *http.Request) {
	userId, ok := userIdFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "no session"})
		return
	}
	productId := mux.Vars(r)["productId"]

	_, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
		TableName: aws.String("Favorites"),
		Key: map[string]*dynamodb.AttributeValue{
			"UserId": {S: aws.String(userId)},
			"ItemId": {S: aws.String(productId)},
		},
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"favorited": false})
}

// StatusHandler reports whether one product is favorited.
func StatusHandler(w http.ResponseWriter, r *http.Request) {
	userId, ok := userIdFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "no session"})
		return
	}
	productId := mux.Vars(r)["productId"]

	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String("Favorites"),
		Key: map[string]*dynamodb.AttributeValue{
			"UserId": {S: aws.String(userId)},
			"ItemId": {S: aws.String(productId)},
		},
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"favorited": result.Item != nil})
}

// ListHandler returns the favorited products with their details.
func ListHandler(w http.ResponseWriter, r *http.Request) {
	userId, ok := userIdFromContext(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "no session"})
		return
	}

	query, err := svc.Query(&dynamodb.QueryInput{
		TableName:              aws.String("Favorites"),
		KeyConditionExpression: aws.String("UserId = :u"),
		ExpressionAttributeValues: map[string]*dynamodb.AttributeValue{
			":u": {S: aws.String(userId)},
		},
	})
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	products := []map[string]interface{}{}
	for _, fav := range query.Items {
		if fav["ItemId"] == nil || fav["ItemId"].S == nil {
			continue
		}
		item, err := svc.GetItem(&dynamodb.GetItemInput{
			TableName: aws.String("Product"),
			Key: map[string]*dynamodb.AttributeValue{
				"ProductId": {S: fav["ItemId"].S},
			},
		})
		// Skip favorites whose product was deleted.
		if err != nil || item.Item == nil {
			continue
		}
		product := map[string]interface{}{}
		for k, v := range item.Item {
			switch {
			case v.S != nil:
				product[k] = *v.S
			case v.N != nil:
				product[k] = *v.N
			case v.SS != nil:
				product[k] = aws.StringValueSlice(v.SS)
			}
		}
		products = append(products, product)
	}
	writeJSON(w, http.StatusOK, products)
}
