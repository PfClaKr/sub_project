package eshandler

import (
	"bytes"
	"encoding/json"
	"strconv"

	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/elastic/go-elasticsearch/v8/esapi"
)

// Community posts live in their own alias, managed like products: bump
// postsVersion after editing postIndexSettings and the next start
// rebuilds the index from the Posts table.
const (
	postsAlias   = "posts"
	postsVersion = "posts_v1"
)

// Only this much of a body is indexed; enough for matching, keeps
// documents small on a 2GB host.
const postBodyIndexed = 2000

// PostDoc is the searchable part of a community post. Lists, filters and
// sorting all come from here; DynamoDB stays the source of truth.
type PostDoc struct {
	PostId       string `json:"PostId"`
	Type         string `json:"Type"`
	Topic        string `json:"Topic,omitempty"`
	Country      string `json:"Country,omitempty"`
	City         string `json:"City,omitempty"`
	Title        string `json:"Title"`
	Body         string `json:"Body,omitempty"`
	Status       string `json:"Status"`
	Solved       bool   `json:"Solved"`
	CreatedAt    int64  `json:"CreatedAt"` // ms
	LikeCount    int    `json:"LikeCount"`
	CommentCount int    `json:"CommentCount"`
	// Derived in source().
	Engagement   int    `json:"Engagement"`
	TitleWords   string `json:"TitleWords"`
	TitleChosung string `json:"TitleChosung"`
}

func (d PostDoc) docID() string { return d.PostId }

func (d PostDoc) source() interface{} {
	if r := []rune(d.Body); len(r) > postBodyIndexed {
		d.Body = string(r[:postBodyIndexed])
	}
	// A like is a stronger signal than a comment.
	d.Engagement = 2*d.LikeCount + d.CommentCount
	d.TitleWords = JamoWords(d.Title)
	d.TitleChosung = ChosungWords(d.Title)
	return d
}

// PostDocFromItem converts a DynamoDB Posts item.
func PostDocFromItem(item map[string]*dynamodb.AttributeValue) PostDoc {
	s := func(k string) string {
		if v := item[k]; v != nil && v.S != nil {
			return *v.S
		}
		return ""
	}
	n := func(k string) int64 {
		if v := item[k]; v != nil && v.N != nil {
			f, _ := strconv.ParseFloat(*v.N, 64)
			return int64(f)
		}
		return 0
	}
	doc := PostDoc{
		PostId:       s("PostId"),
		Type:         s("Type"),
		Topic:        s("Topic"),
		Country:      s("Country"),
		City:         s("City"),
		Title:        s("Title"),
		Body:         s("Body"),
		Status:       s("Status"),
		CreatedAt:    n("CreatedAt"),
		LikeCount:    int(n("LikeCount")),
		CommentCount: int(n("CommentCount")),
	}
	if v := item["Solved"]; v != nil && v.BOOL != nil {
		doc.Solved = *v.BOOL
	}
	return doc
}

var postIndexSettings = `{
	"settings": ` + analysisSettings + `,
	"mappings": {
		"properties": {
			"PostId": {"type": "keyword"},
			"Type": {"type": "keyword"},
			"Topic": {"type": "keyword"},
			"Country": {"type": "keyword"},
			"City": {"type": "keyword"},
			"Status": {"type": "keyword"},
			"Solved": {"type": "boolean"},
			"Title": {
				"type": "text", "analyzer": "ko_index", "search_analyzer": "ko_search",
				"fields": {"compact": {"type": "text", "analyzer": "compact"}}
			},
			"Body": {"type": "text", "analyzer": "ko_index", "search_analyzer": "ko_search"},
			"CreatedAt": {"type": "date", "format": "epoch_millis"},
			"LikeCount": {"type": "integer"},
			"CommentCount": {"type": "integer"},
			"Engagement": {"type": "integer"},
			"TitleWords": ` + wordsField + `,
			"TitleChosung": ` + wordsField + `
		}
	}
}`

// EnsurePostsIndex is EnsureIndex for posts; load returns every post.
func EnsurePostsIndex(load func() ([]PostDoc, error)) error {
	spec := indexSpec{alias: postsAlias, version: postsVersion, settings: postIndexSettings}
	return ensureIndex(spec, func() ([]searchDoc, error) {
		posts, err := load()
		docs := make([]searchDoc, len(posts))
		for i, p := range posts {
			docs[i] = p
		}
		return docs, err
	})
}

// IndexPost creates or replaces a post's search document. Refresh makes
// the change visible to the next list request (the author's redirect).
func IndexPost(doc PostDoc) error {
	b, err := json.Marshal(doc.source())
	if err != nil {
		return err
	}
	_, _, err = do(esapi.IndexRequest{Index: postsAlias, DocumentID: doc.PostId, Body: bytes.NewReader(b), Refresh: "true"})
	return err
}

// DeletePost removes a post's search document; a missing one is fine.
func DeletePost(postId string) error {
	_, status, err := do(esapi.DeleteRequest{Index: postsAlias, DocumentID: postId, Refresh: "true"})
	if status == 404 {
		return nil
	}
	return err
}

// PostPageSize is the default and maximum page size of post lists.
const PostPageSize = 20

// SearchPosts returns one page of matching post ids, newest first unless
// Sort says otherwise, and the total for pagination. With a keyword that
// matches nothing it retries with typo tolerance (corrected=true).
func SearchPosts(opts PostQuery) (ids []string, total int, corrected bool, err error) {
	passes := []bool{false}
	if cleanQuery(opts.Q) != "" && !IsChosungQuery(cleanQuery(opts.Q)) {
		passes = append(passes, true)
	}
	for _, fuzzy := range passes {
		ids, total, err = searchPostIds(buildPostQuery(opts, fuzzy))
		if err != nil || total > 0 {
			return ids, total, fuzzy, err
		}
	}
	return []string{}, 0, false, nil
}

// SimilarQuestions finds earlier questions close to a title being typed,
// solved ones first.
func SimilarQuestions(title string, size int) ([]string, error) {
	q := buildSimilarQuery(title, size)
	if q == nil {
		return []string{}, nil
	}
	ids, _, err := searchPostIds(q)
	return ids, err
}

func searchPostIds(query m) ([]string, int, error) {
	b, err := json.Marshal(query)
	if err != nil {
		return nil, 0, err
	}
	body, _, err := do(esapi.SearchRequest{Index: []string{postsAlias}, Body: bytes.NewReader(b)})
	if err != nil {
		return nil, 0, err
	}
	var res struct {
		Hits struct {
			Total struct {
				Value int `json:"value"`
			} `json:"total"`
			Hits []struct {
				Source struct {
					PostId string `json:"PostId"`
				} `json:"_source"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		return nil, 0, err
	}
	ids := make([]string, 0, len(res.Hits.Hits))
	for _, h := range res.Hits.Hits {
		ids = append(ids, h.Source.PostId)
	}
	return ids, res.Hits.Total.Value, nil
}
