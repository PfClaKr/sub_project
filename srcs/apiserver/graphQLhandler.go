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
		Name: "Product",
		Fields: graphql.Fields{
			"ProductId":          &graphql.Field{Type: graphql.String},
			"UserId":             &graphql.Field{Type: graphql.String},
			"ProductName":        &graphql.Field{Type: graphql.String},
			"ProductDescription": &graphql.Field{Type: graphql.String},
			"ProductPrice":       &graphql.Field{Type: graphql.Float},
			"ProductCategory":    &graphql.Field{Type: graphql.String},
			"ProductImage":       &graphql.Field{Type: graphql.NewList(graphql.String)},
			"PreferedLocation":   &graphql.Field{Type: graphql.String},
			"ProductCreatedAt":   &graphql.Field{Type: graphql.Float},
			"ProductUpdatedAt":   &graphql.Field{Type: graphql.Float},
		},
	},
)

var queryType = graphql.NewObject(
	graphql.ObjectConfig{
		Name: "Query",
		Fields: graphql.Fields{
			"product": &graphql.Field{
				Type: itemType,
				Args: graphql.FieldConfigArgument{
					"ProductId": &graphql.ArgumentConfig{
						Type: graphql.String,
					},
				},
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					productId, ok := p.Args["ProductId"].(string)
					if !ok {
						return nil, fmt.Errorf("missing ProductId argument")
					}

					input := &dynamodb.GetItemInput{
						TableName: aws.String("Product"),
						Key: map[string]*dynamodb.AttributeValue{
							"ProductId": {
								S: aws.String(productId),
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
						"ProductId":          result.Item["ProductId"].S,
						"UserId":             result.Item["UserId"].S,
						"ProductTitle":       result.Item["ProductName"].S,
						"ProductDescription": result.Item["ProductDescription"].S,
						"ProductPrice":       result.Item["ProductPrice"].N,
						"ProductCategory":    result.Item["ProductCategory"].S,
						"ProductImage":       result.Item["ProductImage"].SS,
						"PreferedLocation":   result.Item["PreferedLocation"].S,
						"ProductCreatedAt":   result.Item["ProductCreatedAt"].N,
						"ProductUpdatedAt":   result.Item["ProductUpdatedAt"].N,
					}

					return item, nil
				},
			},
			"productSearch": &graphql.Field{
				Type: graphql.NewList(itemType),
				Args: graphql.FieldConfigArgument{
					"ProductName": &graphql.ArgumentConfig{
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
			"createProduct": &graphql.Field{
				Type: itemType,
				Args: graphql.FieldConfigArgument{
					"ProductItemId":      &graphql.ArgumentConfig{Type: graphql.String},
					"UserId":             &graphql.ArgumentConfig{Type: graphql.String},
					"ProductName":        &graphql.ArgumentConfig{Type: graphql.String},
					"ProductDescription": &graphql.ArgumentConfig{Type: graphql.String},
					"ProductPrice":       &graphql.ArgumentConfig{Type: graphql.Float},
					"ProductCategory":    &graphql.ArgumentConfig{Type: graphql.String},
					"ProductImage":       &graphql.ArgumentConfig{Type: graphql.NewList(graphql.String)},
					"PreferedLocation":   &graphql.ArgumentConfig{Type: graphql.String},
					"ProductCreatedAt":   &graphql.ArgumentConfig{Type: graphql.Float},
					"ProductUpdatedAt":   &graphql.ArgumentConfig{Type: graphql.Float},
				},
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					// DynamoDB에 아이템 생성
					item := map[string]*dynamodb.AttributeValue{
						"ProductId":          {S: aws.String(p.Args["ProductItemId"].(string))},
						"UserId":             {S: aws.String(p.Args["UserId"].(string))},
						"ProductName":        {S: aws.String(p.Args["ProductName"].(string))},
						"ProductDescription": {S: aws.String(p.Args["ProductDescription"].(string))},
						"ProductPrice":       {N: aws.String(fmt.Sprintf("%f", p.Args["ProductPrice"].(float64)))},
						"ProductCategory":    {S: aws.String(p.Args["ProductCategory"].(string))},
						"ProductImage":       {SS: aws.StringSlice(p.Args["ProductImage"].([]string))},
						"PreferedLocation":   {S: aws.String(p.Args["PreferedLocation"].(string))},
						"ProductCreatedAt":   {N: aws.String(fmt.Sprintf("%f", p.Args["ProductCreatedAt"].(float64)))},
						"ProductUpdatedAt":   {N: aws.String(fmt.Sprintf("%f", p.Args["ProductUpdatedAt"].(float64)))},
					}

					_, err := svc.PutItem(&dynamodb.PutItemInput{
						TableName: aws.String("Product"),
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
			"deleteProduct": &graphql.Field{
				Type: graphql.Boolean,
				Args: graphql.FieldConfigArgument{
					"ProductId": &graphql.ArgumentConfig{Type: graphql.String},
				},
				Resolve: func(p graphql.ResolveParams) (interface{}, error) {
					itemId := p.Args["ProductId"].(string)

					// DynamoDB에서 아이템 삭제
					_, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
						TableName: aws.String("Product"),
						Key: map[string]*dynamodb.AttributeValue{
							"ProductId": {S: aws.String(itemId)},
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
