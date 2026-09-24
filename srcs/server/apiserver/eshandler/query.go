package eshandler

import (
	"fmt"
	"strings"
)

type m = map[string]interface{}

// rank favors listings still for sale and recent ones; relevance
// stays the main factor (multiply, gentle weights).
func rank(query m) m {
	return m{"function_score": m{
		"query": query,
		"functions": []m{
			{"filter": m{"term": m{"ProductStatus": "판매완료"}}, "weight": 0.5},
			{"filter": m{"term": m{"ProductStatus": "예약중"}}, "weight": 0.8},
			{"gauss": m{"ProductCreatedAt": m{"origin": "now", "offset": "7d", "scale": "60d", "decay": 0.6}}},
		},
		"score_mode": "multiply",
		"boost_mode": "multiply",
	}}
}

// SearchOptions narrows and orders a search.
type SearchOptions struct {
	Category string
	Region   string
	// Price range in euros; nil means unbounded.
	MinPrice, MaxPrice *float64
	// Sort: "" / "relevance", "newest", "price_asc", "price_desc",
	// "distance" (needs Near).
	Sort string
	Near *GeoFilter
	Size int
}

// GeoFilter keeps products inside an area (AreaId, Km 0) or within Km
// of a point. Lat/Lng also anchor the "distance" sort.
type GeoFilter struct {
	AreaId       string
	Lat, Lng, Km float64
}

func withFilters(query m, opts SearchOptions) m {
	var filters []m
	if opts.Category != "" {
		filters = append(filters, m{"term": m{"ProductCategory": opts.Category}})
	}
	if opts.Region != "" {
		filters = append(filters, m{"term": m{"ProductRegion": opts.Region}})
	}
	if opts.MinPrice != nil || opts.MaxPrice != nil {
		r := m{}
		if opts.MinPrice != nil {
			r["gte"] = *opts.MinPrice
		}
		if opts.MaxPrice != nil {
			r["lte"] = *opts.MaxPrice
		}
		filters = append(filters, m{"range": m{"ProductPrice": r}})
	}
	if opts.Near != nil && opts.Near.Km == 0 && opts.Near.AreaId != "" {
		filters = append(filters, m{"term": m{"AreaId": opts.Near.AreaId}})
	} else if opts.Near != nil {
		filters = append(filters, m{"geo_distance": m{
			"distance": fmt.Sprintf("%gkm", opts.Near.Km),
			"Location": m{"lat": opts.Near.Lat, "lon": opts.Near.Lng},
		}})
	}
	if len(filters) == 0 {
		return query
	}
	return m{"bool": m{"must": query, "filter": filters}}
}

// sortClause returns nil for relevance order (the function_score).
func sortClause(opts SearchOptions) []m {
	switch opts.Sort {
	case "newest":
		return []m{{"ProductCreatedAt": m{"order": "desc", "missing": "_last"}}, {"_score": "desc"}}
	case "price_asc":
		return []m{{"ProductPrice": m{"order": "asc"}}, {"_score": "desc"}}
	case "price_desc":
		return []m{{"ProductPrice": m{"order": "desc"}}, {"_score": "desc"}}
	case "distance":
		if opts.Near != nil && (opts.Near.Lat != 0 || opts.Near.Lng != 0) {
			return []m{{"_geo_distance": m{
				"Location": m{"lat": opts.Near.Lat, "lon": opts.Near.Lng},
				"order":    "asc", "unit": "km",
			}}, {"_score": "desc"}}
		}
	}
	return nil
}

// buildSearchQuery returns nil when there is nothing to search for.
//
// Clauses, strongest first: exact phrase, nori terms (and synonyms),
// chosung, jamo prefix of the last word being typed, space-free
// n-grams, description. fuzzy adds typo-tolerant jamo matching; it is
// only used as a fallback because one wrong jamo also turns real words
// into other real words (거울 → 겨울).
func buildSearchQuery(raw string, opts SearchOptions, fuzzy bool) m {
	q := cleanQuery(raw)
	if q == "" {
		return nil
	}

	var should []m
	if IsChosungQuery(q) {
		should = append(should,
			m{"match": m{"NameChosung": m{"query": q, "operator": "and", "boost": 6}}},
			m{"match": m{"NameChosung.prefix": m{"query": q, "operator": "and", "boost": 4}}},
		)
	} else {
		jamo := JamoWords(q)
		should = append(should,
			m{"match_phrase": m{"ProductName": m{"query": q, "slop": 1, "boost": 6}}},
			// With up to two terms all must match; beyond that 75%.
			m{"match": m{"ProductName": m{"query": q, "minimum_should_match": "2<75%", "boost": 4}}},
			m{"match": m{"NameWords.prefix": m{"query": jamo, "operator": "and", "boost": 2}}},
			m{"match": m{"ProductName.compact": m{"query": q, "minimum_should_match": "80%", "boost": 1}}},
			m{"match": m{"ProductDescription": m{"query": q, "minimum_should_match": "2<75%", "boost": 0.3}}},
		)
		if fuzzy {
			// AUTO:5,9 on jamo ≈ one wrong jamo for a 2-3 syllable word.
			should = append(should, m{"match": m{"NameWords": m{
				"query": jamo, "operator": "and", "boost": 2,
				"fuzziness": "AUTO:5,9", "prefix_length": 1, "max_expansions": 20,
			}}})
		}
		for _, alt := range expandSynonyms(q) {
			should = append(should,
				m{"match": m{"ProductName": m{"query": alt, "minimum_should_match": "2<75%", "boost": 3}}},
				m{"match": m{"NameWords": m{"query": JamoWords(alt), "operator": "and", "boost": 1.5}}},
			)
		}
	}

	size := opts.Size
	if size <= 0 {
		size = 50
	}
	body := m{
		"size":    size,
		"_source": []string{"ProductId"},
		"query":   rank(withFilters(m{"bool": m{"should": should, "minimum_should_match": 1}}, opts)),
	}
	if sort := sortClause(opts); sort != nil {
		body["sort"] = sort
	}
	return body
}

// buildBrowseQuery lists everything that passes the filters.
func buildBrowseQuery(opts SearchOptions) m {
	size := opts.Size
	if size <= 0 {
		size = 50
	}
	sort := sortClause(opts)
	if sort == nil {
		sort = sortClause(SearchOptions{Sort: "newest"})
	}
	return m{
		"size":    size,
		"_source": []string{"ProductId"},
		"query":   withFilters(m{"match_all": m{}}, opts),
		"sort":    sort,
	}
}

// buildSuggestQuery matches names whose words start with the typed
// prefix, in jamo so half-typed syllables count ("아잎" → "아이폰").
func buildSuggestQuery(prefix string, size int) m {
	p := strings.TrimSpace(prefix)
	if p == "" {
		return nil
	}

	var should []m
	if IsChosungQuery(p) {
		should = append(should,
			m{"match": m{"NameChosung.prefix": m{"query": p, "operator": "and", "boost": 3}}},
		)
	} else {
		should = append(should,
			m{"match_phrase_prefix": m{"ProductName": m{"query": p, "boost": 3}}},
			m{"match": m{"NameWords.prefix": m{"query": JamoWords(p), "operator": "and", "boost": 2}}},
		)
	}

	return m{
		"size":    size,
		"_source": []string{"ProductName"},
		"query":   rank(m{"bool": m{"should": should, "minimum_should_match": 1}}),
	}
}
