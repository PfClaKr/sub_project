package eshandler

import "strings"

// Query-time synonyms and filler words. Kept in Go rather than in the
// index settings so the lists can change without reindexing.

// synonymGroups are interchangeable spellings (Korean/English, common
// misspellings, abbreviations).
var synonymGroups = [][]string{
	{"아이폰", "iphone"},
	{"아이패드", "ipad"},
	{"에어팟", "airpods", "airpod"},
	{"맥북", "macbook"},
	{"갤럭시", "galaxy"},
	{"플스", "플레이스테이션", "playstation", "ps5", "ps4"},
	{"닌텐도", "nintendo"},
	{"스위치", "switch"},
	{"소파", "쇼파", "sofa"},
	{"자전거", "바이크", "bike"},
	{"캐리어", "여행가방", "suitcase"},
	{"이케아", "ikea"},
	{"다이슨", "dyson"},
	{"나이키", "nike"},
	{"아디다스", "adidas"},
	{"노스페이스", "northface"},
	{"책상", "desk"},
	{"의자", "chair"},
	{"티비", "tv", "텔레비전", "티브이"},
	{"토픽", "topik"},
	{"델프", "delf"},
	{"전기장판", "전기요", "전기매트"},
	{"밥솥", "전기밥솥"},
	{"유모차", "stroller"},
	{"핸드폰", "휴대폰", "스마트폰"},
}

// broader terms also search for the products they cover.
var broader = map[string][]string{
	"노트북":  {"맥북", "그램", "갤럭시북", "laptop"},
	"랩탑":   {"노트북", "맥북", "그램", "갤럭시북"},
	"핸드폰":  {"아이폰", "갤럭시"},
	"휴대폰":  {"아이폰", "갤럭시"},
	"스마트폰": {"아이폰", "갤럭시"},
	"게임기":  {"닌텐도", "스위치", "플스"},
	"가방":   {"캐리어", "백팩"},
}

// fillerWords carry no meaning in listing titles ("책상 팝니다").
var fillerWords = map[string]bool{
	"팝니다": true, "팔아요": true, "팔아용": true, "팜": true, "판매": true, "판매합니다": true,
	"판매중": true, "삽니다": true, "사요": true, "구해요": true, "구합니다": true, "구매": true,
	"급처": true, "급매": true, "싸게": true, "저렴하게": true, "새상품": true, "미개봉": true,
	"중고": true, "거의": true, "새것": true, "상태": true, "좋아요": true, "좋은": true,
}

var synonymIndex = func() map[string][]string {
	idx := map[string][]string{}
	for _, g := range synonymGroups {
		for _, w := range g {
			for _, other := range g {
				if other != w {
					idx[w] = append(idx[w], other)
				}
			}
		}
	}
	for w, more := range broader {
		idx[w] = append(idx[w], more...)
	}
	return idx
}()

// cleanQuery drops filler words unless nothing else would remain.
func cleanQuery(q string) string {
	words := strings.Fields(strings.TrimSpace(q))
	var kept []string
	for _, w := range words {
		if !fillerWords[strings.ToLower(w)] {
			kept = append(kept, w)
		}
	}
	if len(kept) == 0 {
		return strings.Join(words, " ")
	}
	return strings.Join(kept, " ")
}

// expandSynonyms returns alternative queries with one word replaced by
// a synonym each, capped to keep the ES query small.
func expandSynonyms(q string) []string {
	words := Words(q)
	var alts []string
	for i, w := range words {
		for _, syn := range synonymIndex[w] {
			alt := append(append(append([]string{}, words[:i]...), syn), words[i+1:]...)
			alts = append(alts, strings.Join(alt, " "))
			if len(alts) == 8 {
				return alts
			}
		}
	}
	return alts
}
