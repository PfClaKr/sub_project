package graphqlhandler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
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
		attr, ok := result.Item[field]
		if !ok {
			continue
		}
		switch field {
		case "UserId", "Email", "PasswordHash", "UserNickname", "ProfileImage":
			if attr.S != nil {
				item[field] = *attr.S
			}
		case "PublishedQuantity", "CreatedAt":
			if attr.N != nil {
				item[field] = *attr.N
			}
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

	return mapProductItem(result.Item, fields), nil
}

// mapProductItem converts a DynamoDB product item to a GraphQL map,
// skipping attributes missing on the item.
func mapProductItem(av map[string]*dynamodb.AttributeValue, fields []string) map[string]interface{} {
	item := map[string]interface{}{}
	for _, field := range fields {
		attr, ok := av[field]
		if !ok {
			continue
		}
		switch field {
		case "ProductId", "UserId", "ProductName", "ProductDescription", "ProductCategory", "PreferedLocation":
			if attr.S != nil {
				item[field] = *attr.S
			}
		case "ProductPrice", "ProductCreatedAt", "ProductUpdatedAt":
			if attr.N != nil {
				item[field] = *attr.N
			}
		case "ProductImage":
			item[field] = aws.StringValueSlice(attr.SS)
		}
	}
	return item
}

func resolveRecentProducts(p graphql.ResolveParams) (interface{}, error) {
	limit := 8
	if l, ok := p.Args["Limit"].(float64); ok && l > 0 {
		limit = int(l)
	}

	fields := extractRequestedFields(p.Info.FieldASTs[0].SelectionSet)

	// ProductCreatedAt is needed for sorting even when not requested.
	scanFields := fields
	if !strings.Contains(strings.Join(fields, ","), "ProductCreatedAt") {
		scanFields = append(append([]string{}, fields...), "ProductCreatedAt")
	}

	input := &dynamodb.ScanInput{
		TableName:            aws.String("Product"),
		ProjectionExpression: aws.String(strings.Join(scanFields, ", ")),
	}

	result, err := svc.Scan(input)
	if err != nil {
		return nil, err
	}

	items := make([]map[string]interface{}, 0, len(result.Items))
	for _, av := range result.Items {
		items = append(items, mapProductItem(av, scanFields))
	}

	// Scan cannot order; sort in memory. Fine for MVP data volume,
	// replace with a GSI query after cloud migration.
	createdAt := func(m map[string]interface{}) float64 {
		if s, ok := m["ProductCreatedAt"].(string); ok {
			if v, err := strconv.ParseFloat(s, 64); err == nil {
				return v
			}
		}
		return 0
	}
	sort.Slice(items, func(i, j int) bool {
		return createdAt(items[i]) > createdAt(items[j])
	})

	if len(items) > limit {
		items = items[:limit]
	}
	return items, nil
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
			items = append(items, mapProductItem(result.Item, fields))
		}
	}

	return items, nil
}
