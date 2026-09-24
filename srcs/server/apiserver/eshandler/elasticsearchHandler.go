package eshandler

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/elastic/go-elasticsearch/v8"
	"github.com/elastic/go-elasticsearch/v8/esapi"
)

// Reads and writes go through the alias; the versioned index behind it
// is rebuilt from DynamoDB whenever indexVersion changes (bump it after
// editing indexSettings).
const (
	aliasName    = "products"
	indexVersion = "products_v5"
	legacyIndex  = "nori_sample"
)

var es *elasticsearch.Client

// ProductDoc is the searchable part of a product.
type ProductDoc struct {
	ProductId          string  `json:"ProductId"`
	ProductName        string  `json:"ProductName"`
	ProductDescription string  `json:"ProductDescription,omitempty"`
	ProductCategory    string  `json:"ProductCategory,omitempty"`
	ProductRegion      string  `json:"ProductRegion,omitempty"`
	ProductStatus      string  `json:"ProductStatus,omitempty"`
	ProductCreatedAt   int64   `json:"ProductCreatedAt,omitempty"`
	ProductPrice       float64 `json:"ProductPrice"`
	// Location is a geo_point ({lat, lon}); nil without a map position.
	Location *GeoPoint `json:"Location,omitempty"`
	AreaId   string    `json:"AreaId,omitempty"`
	// Derived in body(); see korean.go.
	NameWords   string `json:"NameWords"`
	NameChosung string `json:"NameChosung"`
}

type GeoPoint struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}

// DocFromItem converts a DynamoDB product item.
func DocFromItem(item map[string]*dynamodb.AttributeValue) ProductDoc {
	s := func(k string) string {
		if v := item[k]; v != nil && v.S != nil {
			return *v.S
		}
		return ""
	}
	doc := ProductDoc{
		ProductId:          s("ProductId"),
		ProductName:        s("ProductName"),
		ProductDescription: s("ProductDescription"),
		ProductCategory:    s("ProductCategory"),
		ProductRegion:      s("ProductRegion"),
		ProductStatus:      s("ProductStatus"),
	}
	n := func(k string) (float64, bool) {
		if v := item[k]; v != nil && v.N != nil {
			f, err := strconv.ParseFloat(*v.N, 64)
			return f, err == nil
		}
		return 0, false
	}
	if v, ok := n("ProductCreatedAt"); ok {
		doc.ProductCreatedAt = int64(v)
	}
	doc.ProductPrice, _ = n("ProductPrice")
	lat, okLat := n("Latitude")
	lng, okLng := n("Longitude")
	if okLat && okLng {
		doc.Location = &GeoPoint{Lat: lat, Lon: lng}
	}
	doc.AreaId = s("AreaId")
	return doc
}

func (d ProductDoc) body() ProductDoc {
	d.NameWords = JamoWords(d.ProductName)
	d.NameChosung = ChosungWords(d.ProductName)
	return d
}

// indexSettings: nori for meaning (mixed decompounding at index time so
// "서랍" finds "서랍장"), a space-free 2-3 gram field for spacing
// variants, and whitespace fields holding jamo/chosung words computed
// in Go (edge n-grams give prefix matching for autocomplete).
const indexSettings = `{
	"settings": {
		"index": {
			"number_of_shards": 1,
			"number_of_replicas": 0,
			"analysis": {
				"tokenizer": {
					"nori_mixed": {"type": "nori_tokenizer", "decompound_mode": "mixed", "discard_punctuation": true},
					"nori_discard": {"type": "nori_tokenizer", "decompound_mode": "discard", "discard_punctuation": true},
					"ngram23": {"type": "ngram", "min_gram": 2, "max_gram": 3}
				},
				"char_filter": {
					"strip_spaces": {"type": "pattern_replace", "pattern": "\\s+", "replacement": ""}
				},
				"filter": {
					"prefix_edge": {"type": "edge_ngram", "min_gram": 1, "max_gram": 30}
				},
				"analyzer": {
					"ko_index": {"type": "custom", "tokenizer": "nori_mixed", "filter": ["lowercase", "nori_readingform", "nori_part_of_speech"]},
					"ko_search": {"type": "custom", "tokenizer": "nori_discard", "filter": ["lowercase", "nori_readingform", "nori_part_of_speech"]},
					"compact": {"type": "custom", "char_filter": ["strip_spaces"], "tokenizer": "ngram23", "filter": ["lowercase"]},
					"words": {"type": "custom", "tokenizer": "whitespace", "filter": ["lowercase"]},
					"words_prefix": {"type": "custom", "tokenizer": "whitespace", "filter": ["lowercase", "prefix_edge"]}
				}
			}
		}
	},
	"mappings": {
		"properties": {
			"ProductId": {"type": "keyword"},
			"ProductName": {
				"type": "text", "analyzer": "ko_index", "search_analyzer": "ko_search",
				"fields": {"compact": {"type": "text", "analyzer": "compact"}}
			},
			"ProductDescription": {"type": "text", "analyzer": "ko_index", "search_analyzer": "ko_search"},
			"ProductCategory": {"type": "keyword"},
			"ProductRegion": {"type": "keyword"},
			"ProductStatus": {"type": "keyword"},
			"ProductCreatedAt": {"type": "date", "format": "epoch_second"},
			"ProductPrice": {"type": "double"},
			"Location": {"type": "geo_point"},
			"AreaId": {"type": "keyword"},
			"NameWords": {
				"type": "text", "analyzer": "words",
				"fields": {"prefix": {"type": "text", "analyzer": "words_prefix", "search_analyzer": "words"}}
			},
			"NameChosung": {
				"type": "text", "analyzer": "words",
				"fields": {"prefix": {"type": "text", "analyzer": "words_prefix", "search_analyzer": "words"}}
			}
		}
	}
}`

func InitElasticsearch() {
	esURL := os.Getenv("ELASTICSEARCH_URL")
	if esURL == "" {
		esURL = "http://elasticsearch:9200"
	}
	var err error
	es, err = elasticsearch.NewClient(elasticsearch.Config{Addresses: []string{esURL}})
	if err != nil {
		log.Fatalf("Error creating the Elasticsearch client: %s", err)
	}

	for {
		res, err := es.Info()
		if err == nil && !res.IsError() {
			res.Body.Close()
			break
		}
		log.Printf("Elasticsearch not ready (%v). Retrying...", err)
		time.Sleep(5 * time.Second)
	}
}

func do(req esapi.Request) ([]byte, int, error) {
	if es == nil {
		return nil, 0, fmt.Errorf("elasticsearch client not initialized")
	}
	res, err := req.Do(context.Background(), es)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, res.StatusCode, err
	}
	if res.IsError() {
		return body, res.StatusCode, fmt.Errorf("elasticsearch %s: %s", res.Status(), body)
	}
	return body, res.StatusCode, nil
}

// EnsureIndex makes the alias point at indexVersion, building it from
// load() (all products from DynamoDB) when it does not exist yet.
func EnsureIndex(load func() ([]ProductDoc, error)) error {
	body, aliasStatus, err := do(esapi.IndicesGetAliasRequest{Name: []string{aliasName}})
	if err == nil && strings.Contains(string(body), `"`+indexVersion+`"`) {
		return nil
	}
	if err != nil && aliasStatus != 404 {
		return err
	}

	if _, status, err := do(esapi.IndicesExistsRequest{Index: []string{indexVersion}}); err != nil && status != 404 {
		return err
	} else if status == 404 {
		if _, _, err := do(esapi.IndicesCreateRequest{Index: indexVersion, Body: strings.NewReader(indexSettings)}); err != nil {
			return fmt.Errorf("create %s: %w", indexVersion, err)
		}
	}

	docs, err := load()
	if err != nil {
		return err
	}
	if err := bulkIndex(indexVersion, docs); err != nil {
		return err
	}
	log.Printf("elasticsearch: indexed %d products into %s", len(docs), indexVersion)

	// Atomically move the alias; old versions are deleted afterwards.
	actions := []map[string]interface{}{
		{"remove": map[string]string{"index": "*", "alias": aliasName}},
		{"add": map[string]string{"index": indexVersion, "alias": aliasName}},
	}
	if aliasStatus == 404 {
		actions = actions[1:] // nothing to remove yet
	}
	aliasBody, _ := json.Marshal(map[string]interface{}{"actions": actions})
	if _, _, err := do(esapi.IndicesUpdateAliasesRequest{Body: bytes.NewReader(aliasBody)}); err != nil {
		return fmt.Errorf("switch alias: %w", err)
	}

	if aliasStatus == 404 {
		body = nil
	}
	for _, old := range oldIndices(body) {
		do(esapi.IndicesDeleteRequest{Index: []string{old}})
	}
	do(esapi.IndicesDeleteRequest{Index: []string{legacyIndex}, IgnoreUnavailable: esapi.BoolPtr(true)})
	return nil
}

// oldIndices lists indices the alias pointed to before, from the
// GET _alias response ({"index": {"aliases": {...}}}).
func oldIndices(aliasResponse []byte) []string {
	var parsed map[string]json.RawMessage
	if json.Unmarshal(aliasResponse, &parsed) != nil {
		return nil
	}
	var out []string
	for name := range parsed {
		if name != indexVersion && name != "error" && name != "status" {
			out = append(out, name)
		}
	}
	return out
}

func bulkIndex(index string, docs []ProductDoc) error {
	for start := 0; start < len(docs); start += 500 {
		end := start + 500
		if end > len(docs) {
			end = len(docs)
		}
		var buf bytes.Buffer
		enc := json.NewEncoder(&buf)
		for _, d := range docs[start:end] {
			enc.Encode(map[string]interface{}{"index": map[string]string{"_index": index, "_id": d.ProductId}})
			enc.Encode(d.body())
		}
		body, _, err := do(esapi.BulkRequest{Body: &buf, Refresh: "true"})
		if err != nil {
			return err
		}
		var res struct {
			Errors bool `json:"errors"`
		}
		if json.Unmarshal(body, &res) == nil && res.Errors {
			return fmt.Errorf("bulk index reported errors: %.500s", body)
		}
	}
	return nil
}

// IndexProduct creates or replaces the search document of a product.
func IndexProduct(doc ProductDoc) error {
	b, err := json.Marshal(doc.body())
	if err != nil {
		return err
	}
	_, _, err = do(esapi.IndexRequest{
		Index:      aliasName,
		DocumentID: doc.ProductId,
		Body:       bytes.NewReader(b),
		Refresh:    "true",
	})
	return err
}

// DeleteProduct removes the search document; a missing one is fine.
func DeleteProduct(productId string) error {
	_, status, err := do(esapi.DeleteRequest{Index: aliasName, DocumentID: productId, Refresh: "true"})
	if status == 404 {
		return nil
	}
	return err
}

func search(query map[string]interface{}) ([]ProductDoc, error) {
	b, err := json.Marshal(query)
	if err != nil {
		return nil, err
	}
	body, _, err := do(esapi.SearchRequest{Index: []string{aliasName}, Body: bytes.NewReader(b)})
	if err != nil {
		return nil, err
	}
	var res struct {
		Hits struct {
			Hits []struct {
				Source ProductDoc `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, err
	}
	docs := make([]ProductDoc, 0, len(res.Hits.Hits))
	for _, h := range res.Hits.Hits {
		docs = append(docs, h.Source)
	}
	return docs, nil
}

// SearchProductIds returns matching product ids. When nothing matches
// it retries with typo tolerance and reports corrected=true so the UI
// can say the results are approximate.
func SearchProductIds(query string, opts SearchOptions) (ids []string, corrected bool, err error) {
	for _, fuzzy := range []bool{false, true} {
		q := buildSearchQuery(query, opts, fuzzy)
		if q == nil {
			return []string{}, false, nil
		}
		docs, err := search(q)
		if err != nil {
			return nil, false, err
		}
		if len(docs) > 0 || IsChosungQuery(query) {
			ids = make([]string, 0, len(docs))
			for _, d := range docs {
				ids = append(ids, d.ProductId)
			}
			return ids, fuzzy, nil
		}
	}
	return []string{}, false, nil
}

// BrowseProductIds lists products without a keyword: filters and sort
// only (newest first by default).
func BrowseProductIds(opts SearchOptions) ([]string, error) {
	docs, err := search(buildBrowseQuery(opts))
	if err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(docs))
	for _, d := range docs {
		ids = append(ids, d.ProductId)
	}
	return ids, nil
}

// Suggest returns distinct product names completing what the user has
// typed so far (partial syllables and chosung included).
func Suggest(prefix string, size int) ([]string, error) {
	q := buildSuggestQuery(prefix, size*3)
	if q == nil {
		return []string{}, nil
	}
	docs, err := search(q)
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	out := []string{}
	for _, d := range docs {
		name := strings.Join(strings.Fields(d.ProductName), " ")
		key := strings.ToLower(name)
		if name == "" || seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, name)
		if len(out) == size {
			break
		}
	}
	return out, nil
}
