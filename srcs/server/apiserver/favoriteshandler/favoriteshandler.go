package favoriteshandler

import (
	"net/http"

	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/gorilla/mux"
)

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

func favoriteKey(userId, productId string) dynamo.Item {
	return dynamo.Item{
		"UserId": {S: aws.String(userId)},
		"ItemId": {S: aws.String(productId)},
	}
}

// AddHandler saves a product to the user's favorites.
// All handlers here must be wrapped with jwt.Middleware.
func AddHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())
	productId := mux.Vars(r)["productId"]

	// Only allow favoriting products that exist.
	_, err := svc.TransactWriteItems(&dynamodb.TransactWriteItemsInput{
		TransactItems: []*dynamodb.TransactWriteItem{
			{ConditionCheck: &dynamodb.ConditionCheck{
				TableName:           aws.String(dynamo.TableProduct),
				Key:                 dynamo.Item{"ProductId": {S: aws.String(productId)}},
				ConditionExpression: aws.String("attribute_exists(ProductId)"),
			}},
			{Put: &dynamodb.Put{
				TableName: aws.String(dynamo.TableFavorites),
				Item:      favoriteKey(userId, productId),
			}},
		},
	})
	if aerr, ok := err.(awserr.Error); ok && aerr.Code() == dynamodb.ErrCodeTransactionCanceledException {
		jsonresponse.Error(w, http.StatusNotFound, "상품을 찾을 수 없어요.")
		return
	}
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusCreated, map[string]bool{"favorited": true})
}

// RemoveHandler deletes a product from the user's favorites.
func RemoveHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())
	productId := mux.Vars(r)["productId"]

	if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
		TableName: aws.String(dynamo.TableFavorites),
		Key:       favoriteKey(userId, productId),
	}); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"favorited": false})
}

// StatusHandler reports whether one product is favorited.
func StatusHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())
	productId := mux.Vars(r)["productId"]

	result, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableFavorites),
		Key:       favoriteKey(userId, productId),
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"favorited": result.Item != nil})
}

// ListHandler returns the favorited products with their details.
func ListHandler(w http.ResponseWriter, r *http.Request) {
	userId := jwt.UserID(r.Context())

	favs, err := dynamo.QueryAll(svc, &dynamodb.QueryInput{
		TableName:                 aws.String(dynamo.TableFavorites),
		KeyConditionExpression:    aws.String("UserId = :u"),
		ExpressionAttributeValues: dynamo.Item{":u": {S: aws.String(userId)}},
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}

	ids := make([]string, 0, len(favs))
	for _, fav := range favs {
		ids = append(ids, dynamo.S(fav, "ItemId"))
	}
	found, err := dynamo.BatchGet(svc, dynamo.TableProduct, "ProductId", ids, "")
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}

	// Favorites whose product was deleted are skipped.
	products := []map[string]interface{}{}
	for _, id := range ids {
		item, ok := found[id]
		if !ok {
			continue
		}
		product := map[string]interface{}{}
		for k, v := range item {
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
	jsonresponse.New(w, http.StatusOK, products)
}
