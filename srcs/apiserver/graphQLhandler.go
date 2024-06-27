package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/graphql-go/graphql"
)

var itemType = graphql.NewObject(
	graphql.ObjectConfig{
		Name: "Item",
		Fields: graphql.Fields{
			"ItemId":      &graphql.Field{Type: graphql.String},
			"UserId":      &graphql.Field{Type: graphql.String},
			"Title":       &graphql.Field{Type: graphql.String},
			"Description": &graphql.Field{Type: graphql.String},
			"Price":       &graphql.Field{Type: graphql.Float},
			"Category":    &graphql.Field{Type: graphql.String},
			"Images":      &graphql.Field{Type: graphql.NewList(graphql.String)},
			"Location":    &graphql.Field{Type: graphql.String},
			"CreatedAt":   &graphql.Field{Type: graphql.Float},
			"UpdatedAt":   &graphql.Field{Type: graphql.Float},
		},
	},
)

var queryType = graphql.NewObject(
	graphql.ObjectConfig{
		Name: "Query",
		Fields: graphql.Fields{
			"item": &graphql.Field{
				Type: itemType,
				Args: graphql.FieldConfigArgument{
					"ItemId": &graphql.ArgumentConfig{
						Type: graphql.String,
					},
				},
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					itemId, ok := p.Args["ItemId"].(string)
					if !ok {
						return nil, fmt.Errorf("missing ItemId argument")
					}

					input := &dynamodb.GetItemInput{
						TableName: aws.String("Items"),
						Key: map[string]*dynamodb.AttributeValue{
							"ItemId": {
								S: aws.String(itemId),
							},
						},
					}

					result, err := svc.GetItem(input)
					if err != nil {
						return nil, err
					}

					if result.Item == nil {
						return nil, nil
					}

					item := map[string]interface{}{
						"ItemId":      result.Item["ItemId"].S,
						"UserId":      result.Item["UserId"].S,
						"Title":       result.Item["Title"].S,
						"Description": result.Item["Description"].S,
						"Price":       result.Item["Price"].N,
						"Category":    result.Item["Category"].S,
						"Images":      result.Item["Images"].SS,
						"Location":    result.Item["Location"].S,
						"CreatedAt":   result.Item["CreatedAt"].N,
						"UpdatedAt":   result.Item["UpdatedAt"].N,
					}

					return item, nil
				},
			},
			"itemSearch": &graphql.Field{
                Type: graphql.NewList(itemType),
                Args: graphql.FieldConfigArgument{
                    "Title": &graphql.ArgumentConfig{
                        Type: graphql.String,
                    },
                },
                Resolve: resolveItemSearch,
            },
		},
	},
)

var mutationType = graphql.NewObject(
	graphql.ObjectConfig{
		Name: "Mutation",
		Fields: graphql.Fields{
			"createItem": &graphql.Field{
				Type: itemType,
				Args: graphql.FieldConfigArgument{
					"ItemId":      &graphql.ArgumentConfig{Type: graphql.String},
					"UserId":      &graphql.ArgumentConfig{Type: graphql.String},
					"Title":       &graphql.ArgumentConfig{Type: graphql.String},
					"Description": &graphql.ArgumentConfig{Type: graphql.String},
					"Price":       &graphql.ArgumentConfig{Type: graphql.Float},
					"Category":    &graphql.ArgumentConfig{Type: graphql.String},
					"Images":      &graphql.ArgumentConfig{Type: graphql.NewList(graphql.String)},
					"Location":    &graphql.ArgumentConfig{Type: graphql.String},
					"CreatedAt":   &graphql.ArgumentConfig{Type: graphql.Float},
					"UpdatedAt":   &graphql.ArgumentConfig{Type: graphql.Float},
				},
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					// DynamoDB에 아이템 생성
					item := map[string]*dynamodb.AttributeValue{
						"ItemId":      {S: aws.String(p.Args["ItemId"].(string))},
						"UserId":      {S: aws.String(p.Args["UserId"].(string))},
						"Title":       {S: aws.String(p.Args["Title"].(string))},
						"Description": {S: aws.String(p.Args["Description"].(string))},
						"Price":       {N: aws.String(fmt.Sprintf("%f", p.Args["Price"].(float64)))},
						"Category":    {S: aws.String(p.Args["Category"].(string))},
						"Images":      {SS: aws.StringSlice(p.Args["Images"].([]string))},
						"Location":    {S: aws.String(p.Args["Location"].(string))},
						"CreatedAt":   {N: aws.String(fmt.Sprintf("%f", p.Args["CreatedAt"].(float64)))},
						"UpdatedAt":   {N: aws.String(fmt.Sprintf("%f", p.Args["UpdatedAt"].(float64)))},
					}

					_, err := svc.PutItem(&dynamodb.PutItemInput{
						TableName: aws.String("Items"),
						Item:      item,
					})
					if err != nil {
						return nil, err
					}

					// Elasticsearch에 아이템 추가
					err = addItemToElasticsearch(item)
					if err != nil {
						return nil, err
					}

					return item, nil
				},
			},
			"deleteItem": &graphql.Field{
				Type: graphql.Boolean,
				Args: graphql.FieldConfigArgument{
					"ItemId": &graphql.ArgumentConfig{Type: graphql.String},
				},
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					itemId := p.Args["ItemId"].(string)

					// DynamoDB에서 아이템 삭제
					_, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
						TableName: aws.String("Items"),
						Key: map[string]*dynamodb.AttributeValue{
							"ItemId": {S: aws.String(itemId)},
						},
					})
					if err != nil {
						return nil, err
					}

					// Elasticsearch에서 아이템 삭제
					err = deleteItemFromElasticsearch(itemId)
					if err != nil {
						return nil, err
					}

					return true, nil
				},
			},
		},
	},
)

var schema, _ = graphql.NewSchema(
	graphql.SchemaConfig{
		Query: queryType,
	},
)

func executeQuery(query string, schema graphql.Schema) *graphql.Result {
	result := graphql.Do(graphql.Params{
		Schema:        schema,
		RequestString: query,
	})
	if len(result.Errors) > 0 {
		log.Printf("errors: %v", result.Errors)
	}
	return result
}

func graphqlHandler(w http.ResponseWriter, r *http.Request) {
	var query struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result := executeQuery(query.Query, schema)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

/*
	curl -X GET "127.0.0.1:8080/graphql" -H 'Content-Type: application/json' -d '{"query":"{ item(ItemId: \"Item1\") { Title UpdatedAt } }"}'
*/
