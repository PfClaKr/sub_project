package main

import (
	"fmt"
	"net/http"
	"encoding/json"
	"log"

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