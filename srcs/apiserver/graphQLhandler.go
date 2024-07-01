package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/language/ast"
)

func extractRequestedFields(selectionSet *ast.SelectionSet) []string {
	fields := []string{}
	for _, selection := range selectionSet.Selections {
		switch field := selection.(type) {
		case *ast.Field:
			fields = append(fields, field.Name.Value)
		case *ast.InlineFragment:
			fields = append(fields, extractRequestedFields(field.SelectionSet)...)
		}
	}
	return fields
}

var schema, _ = graphql.NewSchema(
	graphql.SchemaConfig{
		Query:    queryType,
		Mutation: mutationType,
	},
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

var userType = graphql.NewObject(
	graphql.ObjectConfig{
		Name: "User",
		Fields: graphql.Fields{
			"UserId":            &graphql.Field{Type: graphql.String},
			"Email":             &graphql.Field{Type: graphql.String},
			"PasswordHash":      &graphql.Field{Type: graphql.String},
			"UserNickname":      &graphql.Field{Type: graphql.String},
			"ProfileImage":      &graphql.Field{Type: graphql.String},
			"PublishedQuantity": &graphql.Field{Type: graphql.Float},
			"CreatedAt":         &graphql.Field{Type: graphql.Float},
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
				Resolve: resolveItem,
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
			"user": &graphql.Field{
				Type: userType,
				Args: graphql.FieldConfigArgument{
					"UserId": &graphql.ArgumentConfig{
						Type: graphql.String,
					},
				},
				Resolve: resolveUser,
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

					_, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
						TableName: aws.String("Product"),
						Key: map[string]*dynamodb.AttributeValue{
							"ProductId": {S: aws.String(itemId)},
						},
					})
					if err != nil {
						return nil, err
					}

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

func resolveUser(p graphql.ResolveParams) (interface{}, error) {
	userid, ok := p.Args["UserId"].(string)
	if !ok {
		return nil, fmt.Errorf("missing UserId argument")
	}

	fields := extractRequestedFields(p.Info.FieldASTs[0].SelectionSet)
	projectionExpression := strings.Join(fields, ", ")

	input := &dynamodb.GetItemInput{
		TableName: aws.String("Users"),
		Key: map[string]*dynamodb.AttributeValue{
			"UserId": {
				S: aws.String(userid),
			},
		},
		ProjectionExpression: aws.String(projectionExpression),
	}

	result, err := svc.GetItem(input)
	if err != nil {
		return nil, err
	}

	if result.Item == nil {
		return nil, nil
	}

	item := map[string]interface{}{}
	for _, field := range fields {
		switch field {
		case "UserId", "Email", "PasswordHash", "UserNickname", "ProfileImage":
			item[field] = *result.Item[field].S
		case "PublishedQuantity", "CreatedAt":
			item[field] = *result.Item[field].N
		}
	}

	return item, nil
}

func resolveItem(p graphql.ResolveParams) (interface{}, error) {
	productId, ok := p.Args["ProductId"].(string)
	if !ok {
		return nil, fmt.Errorf("missing ProductId argument")
	}

	fields := extractRequestedFields(p.Info.FieldASTs[0].SelectionSet)
	projectionExpression := strings.Join(fields, ", ")

	input := &dynamodb.GetItemInput{
		TableName: aws.String("Product"),
		Key: map[string]*dynamodb.AttributeValue{
			"ProductId": {
				S: aws.String(productId),
			},
		},
		ProjectionExpression: aws.String(projectionExpression),
	}

	result, err := svc.GetItem(input)
	if err != nil {
		return nil, err
	}

	if result.Item == nil {
		return nil, nil
	}

	item := map[string]interface{}{}
	for _, field := range fields {
		switch field {
		case "ProductId", "UserId", "ProductName", "ProductDescription", "ProductCategory", "PreferedLocation":
			item[field] = *result.Item[field].S
		case "ProductPrice", "ProductCreatedAt", "ProductUpdatedAt":
			item[field] = *result.Item[field].N
		case "ProductImage":
			item[field] = aws.StringValueSlice(result.Item[field].SS)
		}
	}

	return item, nil
}

func resolveItemSearch(p graphql.ResolveParams) (interface{}, error) {
	productName, ok := p.Args["ProductName"].(string)
	if !ok {
		return nil, fmt.Errorf("missing ProductName argument")
	}

	fields := extractRequestedFields(p.Info.FieldASTs[0].SelectionSet)
	projectionExpression := strings.Join(fields, ", ")

	query := map[string]interface{}{
		"query": map[string]interface{}{
			"match": map[string]interface{}{
				"ProductName.nori": productName,
			},
		},
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(query); err != nil {
		return nil, err
	}

	res, err := es.Search(
		es.Search.WithContext(context.Background()),
		es.Search.WithIndex("nori_sample"),
		es.Search.WithBody(&buf),
	)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()

	if res.IsError() {
		return nil, fmt.Errorf("error searching document: %s", res.String())
	}

	var searchResult map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&searchResult); err != nil {
		return nil, err
	}

	hits := searchResult["hits"].(map[string]interface{})["hits"].([]interface{})
	if len(hits) == 0 {
		return nil, nil
	}

	var items []map[string]interface{}
	for _, hit := range hits {
		source := hit.(map[string]interface{})["_source"].(map[string]interface{})
		productId := source["ProductId"].(string)

		input := &dynamodb.GetItemInput{
			TableName: aws.String("Product"),
			Key: map[string]*dynamodb.AttributeValue{
				"ProductId": {
					S: aws.String(productId),
				},
			},
			ProjectionExpression: aws.String(projectionExpression),
		}

		result, err := svc.GetItem(input)
		if err != nil {
			return nil, err
		}

		if result.Item != nil {
			item := map[string]interface{}{}
			for _, field := range fields {
				switch field {
				case "ProductId", "UserId", "ProductName", "ProductDescription", "ProductCategory", "PreferedLocation":
					item[field] = *result.Item[field].S
				case "ProductPrice", "ProductCreatedAt", "ProductUpdatedAt":
					item[field] = *result.Item[field].N
				case "ProductImage":
					item[field] = aws.StringValueSlice(result.Item[field].SS)
				}
			}
			items = append(items, item)
		}
	}

	return items, nil
}

func graphqlHandler(w http.ResponseWriter, r *http.Request) {
	var query struct {
		Query string `json:"query"`
	}
	if err := json.NewDecoder(r.Body).Decode(&query); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	resultChan := make(chan *graphql.Result)
	errChan := make(chan error)

	go func() {
		result := executeQuery(query.Query, schema)
		if result.HasErrors() {
			errChan <- fmt.Errorf("GraphQL query execution failed")
			return
		}
		resultChan <- result
	}()

	select {
	case result := <-resultChan:
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	case err := <-errChan:
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
