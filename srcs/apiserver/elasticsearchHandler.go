package main

import (
	"bytes"
	"context"
	"fmt"
	"encoding/json"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
	"github.com/aws/aws-sdk-go/aws"
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
		"ItemId": item["ItemId"].S,
		"Title":  item["Title"].S,
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(doc); err != nil {
		return err
	}

	req := esapi.IndexRequest{
		Index:      "nori_sample",
		DocumentID: *item["ItemId"].S,
		Body:       &buf,
		Refresh:    "true",
	}

	res, err := req.Do(context.Background(), es)
	if err != nil {
		return err
	}
	defer res.Body.Close()

	if res.IsError() {
		return fmt.Errorf("error indexing document ID=%s", *item["ItemId"].S)
	}

	return nil
}

func deleteItemFromElasticsearch(itemId string) error {
	req := esapi.DeleteRequest{
		Index:      "items",
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
}

func resolveItemSearch(p graphql.ResolveParams) (interface{}, error) {
    title, ok := p.Args["Title"].(string)
    if !ok {
        return nil, fmt.Errorf("missing Title argument")
    }

    // Elasticsearch 검색 쿼리
    query := map[string]interface{}{
        "query": map[string]interface{}{
            "match": map[string]interface{}{
				"Title.nori": title,
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
        return nil, nil
    }

    // DynamoDB에서 아이템 가져오기
    var items []map[string]interface{}
    for _, hit := range hits {
        source := hit.(map[string]interface{})["_source"].(map[string]interface{})
        itemId := source["ItemId"].(string)

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

        if result.Item != nil {
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
            items = append(items, item)
        }
    }

    return items, nil
}