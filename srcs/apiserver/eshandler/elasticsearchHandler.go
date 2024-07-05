package eshandler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
)

var es *elasticsearch.Client

func InitElasticsearch() {
	cfg := elasticsearch.Config{
		Addresses: []string{
			"http://elasticsearch:9200",
		},
	}
	var err error
	es, err = elasticsearch.NewClient(cfg)
	if err != nil {
		log.Fatalf("Error creating the Elasticsearch client: %s", err)
	}

	for {
		res, err := es.Info()
		if err != nil {
			log.Printf("Error getting Elasticsearch info: %s. Retrying...", err)
			time.Sleep(5 * time.Second)
			continue
		}
		if res.IsError() {
			log.Printf("Elasticsearch not ready: %s. Retrying...", res.String())
			time.Sleep(5 * time.Second)
			continue
		}
		break
	}

	settings := `{
		"settings": {
			"index": {
				"analysis": {
					"tokenizer": {
						"my_nori_tokenizer": {
							"type": "nori_tokenizer",
							"decompound_mode": "mixed",
							"discard_punctuation": "false"
						},
						"my_ngram_tokenizer": {
							"type": "ngram",
							"min_gram": 2,
							"max_gram": 3
						}
					},
					"filter": {
						"stopwords": {
							"type": "stop",
							"stopwords": " "
						}
					},
					"analyzer": {
						"my_nori_analyzer": {
							"type": "custom",
							"tokenizer": "my_nori_tokenizer",
							"filter": ["lowercase", "stop", "trim", "stopwords", "nori_part_of_speech"],
							"char_filter": ["html_strip"]
						},
						"my_ngram_analyzer": {
							"type": "custom",
							"tokenizer": "my_ngram_tokenizer",
							"filter": ["lowercase", "stop", "trim", "stopwords", "nori_part_of_speech"],
							"char_filter": ["html_strip"]
						}
					}
				}
			}
		},
		"mappings": {
			"properties": {
				"ProductName": {
					"type": "text",
					"analyzer": "standard",
					"search_analyzer": "standard",
					"fields": {
						"nori": {
							"type": "text",
							"analyzer": "my_nori_analyzer",
							"search_analyzer": "my_nori_analyzer"
						},
						"ngram": {
							"type": "text",
							"analyzer": "my_ngram_analyzer",
							"search_analyzer": "my_ngram_analyzer"
						}
					}
				}
			}
		}
	}`

	ctx := context.Background()
	exists, err := es.Indices.Exists([]string{"nori_sample"})
	if err != nil {
		log.Fatalf("Error checking if index exists: %s", err)
	}
	if exists.StatusCode == 404 {
		req := esapi.IndicesCreateRequest{
			Index: "nori_sample",
			Body:  strings.NewReader(settings),
		}
		res, err := req.Do(ctx, es)
		if err != nil {
			log.Fatalf("Error creating index: %s", err)
		}
		defer res.Body.Close()
		if res.IsError() {
			log.Fatalf("Error response from Elasticsearch: %s", res.String())
		}
	}
}

func FindItemWithProductName(buf *bytes.Buffer) (*esapi.Response, error) {
	res, err := es.Search(
		es.Search.WithContext(context.Background()),
		es.Search.WithIndex("nori_sample"),
		es.Search.WithBody(buf),
	)
	return res, err
}

func AddItemToElasticsearch(item map[string]*dynamodb.AttributeValue) error {
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

func DeleteItemFromElasticsearch(itemId string) error {
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
