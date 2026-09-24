package eshandler

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCleanQuery(t *testing.T) {
	cases := map[string]string{
		"책상 팝니다":    "책상",
		"  급처 아이폰 ": "아이폰",
		"팝니다":       "팝니다", // nothing else left: keep as is
	}
	for in, want := range cases {
		if got := cleanQuery(in); got != want {
			t.Errorf("cleanQuery(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestExpandSynonyms(t *testing.T) {
	alts := expandSynonyms("iphone 13")
	if len(alts) == 0 || alts[0] != "아이폰 13" {
		t.Errorf("expandSynonyms(iphone 13) = %q", alts)
	}
	if alts := expandSynonyms("노트북"); !contains(alts, "맥북") {
		t.Errorf("broader term must include 맥북: %q", alts)
	}
	if alts := expandSynonyms("책상"); len(alts) != 1 || alts[0] != "desk" {
		t.Errorf("expandSynonyms(책상) = %q", alts)
	}
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

func TestBuildSearchQuery(t *testing.T) {
	if buildSearchQuery("   ", SearchOptions{}, false) != nil {
		t.Error("blank query must return nil")
	}

	js := func(v interface{}) string { b, _ := json.Marshal(v); return string(b) }

	chosung := js(buildSearchQuery("ㅇㅇㅍ", SearchOptions{}, true))
	if !strings.Contains(chosung, "NameChosung") || strings.Contains(chosung, "NameWords") {
		t.Errorf("chosung query should only use chosung fields: %s", chosung)
	}

	if strict := js(buildSearchQuery("아이퐁", SearchOptions{}, false)); strings.Contains(strict, "fuzziness") {
		t.Errorf("first pass must not be fuzzy: %s", strict)
	}
	normal := js(buildSearchQuery("아이퐁", SearchOptions{Category: "전자기기"}, true))
	for _, want := range []string{`"fuzziness"`, `ㅇㅏㅇㅣㅍㅗㅇ`, `"ProductCategory":"전자기기"`, `"function_score"`} {
		if !strings.Contains(normal, want) {
			t.Errorf("query missing %s: %s", want, normal)
		}
	}
}

func TestFiltersAndBrowse(t *testing.T) {
	js := func(v interface{}) string { b, _ := json.Marshal(v); return string(b) }
	lo, hi := 10.0, 100.0
	opts := SearchOptions{Region: "파리", MinPrice: &lo, MaxPrice: &hi}
	q := js(buildSearchQuery("책상", opts, false))
	for _, want := range []string{`"ProductRegion":"파리"`, `"gte":10`, `"lte":100`} {
		if !strings.Contains(q, want) {
			t.Errorf("search query missing %s: %s", want, q)
		}
	}
	onlyMax := js(buildSearchQuery("책상", SearchOptions{MaxPrice: &hi}, false))
	if strings.Contains(onlyMax, `"gte"`) {
		t.Errorf("unset MinPrice must not add a lower bound: %s", onlyMax)
	}
	browse := js(buildBrowseQuery(opts))
	if !strings.Contains(browse, "match_all") || !strings.Contains(browse, `"ProductCreatedAt"`) {
		t.Errorf("browse must list newest first with filters: %s", browse)
	}
}

func TestBuildSuggestQuery(t *testing.T) {
	b, _ := json.Marshal(buildSuggestQuery("아잎", 10))
	if !strings.Contains(string(b), "ㅇㅏㅇㅣㅍ") {
		t.Errorf("suggest must query the jamo prefix: %s", b)
	}
	if buildSuggestQuery(" ", 10) != nil {
		t.Error("blank prefix must return nil")
	}
}

func TestSearchSortAndGeo(t *testing.T) {
	js := func(v interface{}) string { b, _ := json.Marshal(v); return string(b) }
	near := &GeoFilter{Lat: 48.85, Lng: 2.29, Km: 5}

	if q := js(buildSearchQuery("책상", SearchOptions{}, false)); strings.Contains(q, `"sort"`) {
		t.Errorf("relevance must not add a sort: %s", q)
	}
	cases := map[string]string{
		"newest":     `"ProductCreatedAt":{"missing":"_last","order":"desc"}`,
		"price_asc":  `"ProductPrice":{"order":"asc"}`,
		"price_desc": `"ProductPrice":{"order":"desc"}`,
		"distance":   `"_geo_distance"`,
	}
	for sort, want := range cases {
		q := js(buildSearchQuery("책상", SearchOptions{Sort: sort, Near: near}, false))
		if !strings.Contains(q, want) {
			t.Errorf("sort %s: missing %s in %s", sort, want, q)
		}
	}
	if q := js(buildSearchQuery("책상", SearchOptions{Sort: "distance"}, false)); strings.Contains(q, "_geo_distance") {
		t.Error("distance sort without a point must fall back to relevance")
	}
	if q := js(buildSearchQuery("책상", SearchOptions{Near: near}, false)); !strings.Contains(q, `"distance":"5km"`) {
		t.Errorf("geo filter missing: %s", q)
	}
	inArea := js(buildSearchQuery("책상", SearchOptions{Near: &GeoFilter{AreaId: "R9520"}}, false))
	if !strings.Contains(inArea, `"AreaId":"R9520"`) || strings.Contains(inArea, "geo_distance") {
		t.Errorf("area filter must be a term on AreaId: %s", inArea)
	}
}
