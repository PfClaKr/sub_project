package graphqlhandler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"apiserver/eshandler"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/google/uuid"
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

func createUserResolver(p graphql.ResolveParams) (interface{}, error) {
	item := map[string]*dynamodb.AttributeValue{
		"UserId":            {S: aws.String(uuid.NewString())},
		"Email":             {S: aws.String(p.Args["Email"].(string))},
		"PasswordHash":      {S: aws.String(p.Args["PasswordHash"].(string))},
		"UserNickname":      {S: aws.String(p.Args["UserNickname"].(string))},
		"ProfileImage":      {S: aws.String("https://cdn.icon-icons.com/icons2/1378/PNG/512/avatardefault_92824.png")},
		"PublishedQuantity": {N: aws.String("0")},
		"CreatedAt":         {N: aws.String(fmt.Sprintf("%d", time.Now().Unix()))},
	}

	_, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String("Users"),
		Item:      item,
	})
	if err != nil {
		return nil, err
	}

	return item, nil
}

func createProductResolver(p graphql.ResolveParams) (interface{}, error) {
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

	// Assuming addItemToElasticsearch is defined
	err = eshandler.AddItemToElasticsearch(item)
	if err != nil {
		return nil, err
	}

	return item, nil
}

func deleteProductResolver(p graphql.ResolveParams) (interface{}, error) {
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

	err = eshandler.DeleteItemFromElasticsearch(itemId)
	if err != nil {
		return nil, err
	}

	return true, nil
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

	res, err := eshandler.FindItemWithProductName(&buf)

	// res, err := es.Search(
	// 	es.Search.WithContext(context.Background()),
	// 	es.Search.WithIndex("nori_sample"),
	// 	es.Search.WithBody(&buf),
	// )
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
