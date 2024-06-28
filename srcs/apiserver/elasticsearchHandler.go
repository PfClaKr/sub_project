package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
	"github.com/graphql-go/graphql"
)

var es *elasticsearch.Client

func initElasticsearch() {
	cfg := elasticsearch.Config{
		Addresses: []string{
			"http://elasticsearch:9200",
		},
	}
	es, _ = elasticsearch.NewClient(cfg)
}

func addItemToElasticsearch(item map[string]*dynamodb.AttributeValue) error {
	doc := map[string]interface{}{
		"ProductId":   item["ProductId"].S,
		"ProductName": item["ProductName"].S,
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(doc); err != nil {
		return err
	}

	req := esapi.IndexRequest{
		Index:      "nori_sample",
		DocumentID: *item["ProductId"].S,
		Body:       &buf,
		Refresh:    "true",
	}

	res, err := req.Do(context.Background(), es)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("error indexing document ID=%s", *item["ProductId"].S)
	}

	return nil
}

func deleteItemFromElasticsearch(itemId string) error {
	req := esapi.DeleteRequest{
		Index:      "nori_sample",
		DocumentID: itemId,
		Refresh:    "true",
	}

	res, err := req.Do(context.Background(), es)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("error deleting document ID=%s", itemId)
	}

	return nil
}

func resolveItem(p graphql.ResolveParams) (interface{}, error) {
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
		"ProductName":        result.Item["ProductName"].S,
		"ProductDescription": result.Item["ProductDescription"].S,
		"ProductPrice":       result.Item["ProductPrice"].N,
		"ProductCategory":    result.Item["ProductCategory"].S,
		"ProductImage":       result.Item["ProductImage"].SS,
		"PreferedLocation":   result.Item["PreferedLocation"].S,
		"ProductCreatedAt":   result.Item["ProductCreatedAt"].N,
		"ProductUpdatedAt":   result.Item["ProductUpdatedAt"].N,
	}

	return item, nil
}

func resolveItemSearch(p graphql.ResolveParams) (interface{}, error) {
	productName, ok := p.Args["ProductName"].(string)
	if !ok {
		return nil, fmt.Errorf("missing ProductName argument")
	}

	// Elasticsearch 검색 쿼리
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

	// Elasticsearch 요청
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

	// Elasticsearch 결과 파싱
	var searchResult map[string]interface{}
	if err := json.NewDecoder(res.Body).Decode(&searchResult); err != nil {
		return nil, err
	}

	hits := searchResult["hits"].(map[string]interface{})["hits"].([]interface{})
	if len(hits) == 0 {
		return nil, fmt.Errorf("There is no result")
	}

	// DynamoDB에서 아이템 가져오기
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
		}

		result, err := svc.GetItem(input)
		if err != nil {
			return nil, err
		}

		if result.Item != nil {
			item := map[string]interface{}{
				"ProductId":          result.Item["ProductId"].S,
				"UserId":             result.Item["UserId"].S,
				"ProductName":        result.Item["ProductName"].S,
				"ProductDescription": result.Item["ProductDescription"].S,
				"ProductPrice":       result.Item["ProductPrice"].N,
				"ProductCategory":    result.Item["ProductCategory"].S,
				"ProductImage":       result.Item["ProductImage"].SS,
				"PreferedLocation":   result.Item["PreferedLocation"].S,
				"ProductCreatedAt":   result.Item["ProductCreatedAt"].N,
				"ProductUpdatedAt":   result.Item["ProductUpdatedAt"].N,
			}
			items = append(items, item)
		}
	}

	return items, nil
}
