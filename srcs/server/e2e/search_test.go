//go:build e2e

package e2e

import (
	"testing"
)

// Korean search regressions (see apiserver/eshandler). Assertions only
// require our own listings to be found, so other data may exist.
func TestKoreanSearch(t *testing.T) {
	s := signup(t, "search")
	iphone := newProduct(t, s, "아이폰 13 프로 128GB 팝니다", 390, "전자기기")
	desk := newProduct(t, s, "이케아 원목 책상", 45, "가구")
	sofa := newProduct(t, s, "3인용 패브릭 소파", 120, "가구")
	vacuum := newProduct(t, s, "다이슨 청소기 V11", 180, "전자기기")

	cases := []struct {
		query     string
		want      product
		corrected bool
		why       string
	}{
		{"아이폰", iphone, false, "plain word"},
		{"아이폰13", iphone, false, "no space"},
		{"iphone", iphone, false, "English synonym"},
		{"책상 팝니다", desk, false, "filler word dropped"},
		{"원목", desk, false, "part of the title"},
		{"쇼파", sofa, false, "common misspelling synonym"},
		{"ㅊㅅㄱ", vacuum, false, "chosung"},
		{"아이퐁", iphone, true, "typo, fuzzy fallback"},
	}
	for _, c := range cases {
		got := search(t, c.query, nil)
		if !contains(ids(got.Products), c.want.ProductId) {
			t.Errorf("%s: %q did not find %q (got %d results)", c.why, c.query, c.want.ProductName, len(got.Products))
		}
		if c.corrected && !got.Corrected {
			t.Errorf("%s: %q should be marked Corrected", c.why, c.query)
		}
	}

	// A real word must not be "corrected" into a listing when a direct
	// match exists, and unrelated words find none of ours.
	if got := search(t, "냉장고", nil); contains(ids(got.Products), desk.ProductId) || contains(ids(got.Products), iphone.ProductId) {
		t.Error("냉장고 must not match our listings")
	}

	if got := search(t, "원목 책상", map[string]interface{}{"cat": "전자기기"}); contains(ids(got.Products), desk.ProductId) {
		t.Error("category filter ignored")
	}
}

func TestSearchSort(t *testing.T) {
	s := signup(t, "sort")
	token := "정렬테스트" + runID
	cheap := newProduct(t, s, token+" 싼거", 5, "기타")
	mid := newProduct(t, s, token+" 중간", 50, "기타")
	pricey := newProduct(t, s, token+" 비싼거", 500, "기타")

	order := func(sort string) []string {
		var out []string
		for _, id := range ids(search(t, token, map[string]interface{}{"sort": sort}).Products) {
			if id == cheap.ProductId || id == mid.ProductId || id == pricey.ProductId {
				out = append(out, id)
			}
		}
		return out
	}
	eq := func(a, b []string) bool {
		if len(a) != len(b) {
			return false
		}
		for i := range a {
			if a[i] != b[i] {
				return false
			}
		}
		return true
	}

	if got, want := order("price_asc"), []string{cheap.ProductId, mid.ProductId, pricey.ProductId}; !eq(got, want) {
		t.Errorf("price_asc = %v, want %v", got, want)
	}
	if got, want := order("price_desc"), []string{pricey.ProductId, mid.ProductId, cheap.ProductId}; !eq(got, want) {
		t.Errorf("price_desc = %v, want %v", got, want)
	}
	if got := order("newest"); len(got) != 3 {
		t.Errorf("newest returned %d of 3", len(got))
	}
}

func TestAutocomplete(t *testing.T) {
	s := signup(t, "suggest")
	name := "갤럭시 탭 S9 " + runID
	newProduct(t, s, name, 300, "전자기기")

	// Half-typed syllables ("갤러" while typing 갤럭시) must match.
	for _, prefix := range []string{"갤", "갤러", "갤럭시 탭"} {
		var names []string
		gql(t, newClient(), `query($p: String!) { searchSuggestions(Prefix: $p) }`, map[string]interface{}{"p": prefix}).field(t, "searchSuggestions", &names)
		if !contains(names, name) {
			t.Errorf("suggestions for %q = %v, missing %q", prefix, names, name)
		}
	}
}
