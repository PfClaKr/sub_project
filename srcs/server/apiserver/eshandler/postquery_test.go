package eshandler

import (
	"encoding/json"
	"strings"
	"testing"
)

func js(v interface{}) string { b, _ := json.Marshal(v); return string(b) }

func TestBuildPostQuery(t *testing.T) {
	solved := false
	q := js(buildPostQuery(PostQuery{Types: []string{"qna"}, Topic: "체류증·비자", City: "파리", Solved: &solved, Page: 3}, false))
	for _, want := range []string{
		`{"term":{"Status":"active"}}`, `{"terms":{"Type":["qna"]}}`, `{"term":{"Topic":"체류증·비자"}}`,
		`{"term":{"City":"파리"}}`, `{"term":{"Solved":false}}`, `"from":40`, `"track_total_hits":true`,
		`"sort":[{"CreatedAt":{"order":"desc"}}]`,
	} {
		if !strings.Contains(q, want) {
			t.Errorf("query lacks %s:\n%s", want, q)
		}
	}

	text := js(buildPostQuery(PostQuery{Q: "체류증 갱신"}, false))
	if !strings.Contains(text, `"Title"`) || !strings.Contains(text, `"_score":"desc"`) {
		t.Errorf("keyword query should match titles by relevance:\n%s", text)
	}
	if strings.Contains(text, "fuzziness") {
		t.Error("first pass must not be fuzzy")
	}

	pop := js(buildPostQuery(PostQuery{Sort: "popular"}, false))
	if !strings.Contains(pop, `"Engagement"`) || !strings.Contains(pop, `"boost_mode":"replace"`) {
		t.Errorf("popular without keyword should score by engagement only:\n%s", pop)
	}
}

func TestPageBounds(t *testing.T) {
	if from, size := pageBounds(PostQuery{Page: 0, Size: 500}); from != 0 || size != PostPageSize {
		t.Errorf("page 0 size 500 = %d,%d", from, size)
	}
	if from, size := pageBounds(PostQuery{Page: 100000}); from+size > 10000 {
		t.Errorf("deep page goes past the result window: %d+%d", from, size)
	}
}

func TestSimilarQuery(t *testing.T) {
	if buildSimilarQuery("가", 5) != nil {
		t.Error("one syllable must not search")
	}
	q := js(buildSimilarQuery("체류증 갱신 어떻게 하나요", 5))
	if !strings.Contains(q, `{"terms":{"Type":["qna"]}}`) || !strings.Contains(q, `"Solved":true`) {
		t.Errorf("similar query = %s", q)
	}
}

func TestPostSourceDerivesFields(t *testing.T) {
	d := PostDoc{Title: "체류증 갱신", Body: strings.Repeat("가", 3000), LikeCount: 2, CommentCount: 3}.source().(PostDoc)
	if d.Engagement != 7 || d.TitleChosung == "" || len([]rune(d.Body)) != postBodyIndexed {
		t.Errorf("derived = engagement %d, chosung %q, body %d", d.Engagement, d.TitleChosung, len([]rune(d.Body)))
	}
}
