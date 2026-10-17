package eshandler

import "fmt"

// PostQuery selects and orders community posts.
type PostQuery struct {
	Q       string
	Types   []string // e.g. ["free", "qna"]; empty means any
	Topic   string
	City    string
	Country string
	Solved  *bool // Q&A: only solved / only open questions
	// Sort: "newest" (default without Q), "popular", or "" for relevance
	// when Q is set; housing/job also "rent_asc", "wage_desc",
	// "available" (soonest move-in first) and "distance" (needs Near).
	Sort string
	Page int // 1-based
	Size int

	// Housing and job filters.
	Mode          string
	Topics        []string // housing kinds or job sectors (stored as Topic)
	MinRent       *float64
	MaxRent       *float64
	AvailableBy   string // YYYY-MM-DD: move-in possible on or before
	Furnished     bool
	Caf           bool
	Pets          bool
	Employment    []string
	MinWage       *float64 // hourly wage
	PermitFree    bool     // only jobs that do not require a work permit
	Near          *GeoFilter
	IncludeClosed bool // also list deals marked closed (the author's own lists)
}

var postFields = textFields{Name: "Title", Words: "TitleWords", Chosung: "TitleChosung", Body: "Body"}

// Only active posts are listed; hidden (reported) and deleted ones never
// reach a list.
func postFilters(opts PostQuery) []m {
	filters := []m{{"term": m{"Status": "active"}}}
	if len(opts.Types) > 0 {
		filters = append(filters, m{"terms": m{"Type": opts.Types}})
	}
	for field, value := range map[string]string{"Topic": opts.Topic, "City": opts.City, "Country": opts.Country} {
		if value != "" {
			filters = append(filters, m{"term": m{field: value}})
		}
	}
	if opts.Solved != nil {
		filters = append(filters, m{"term": m{"Solved": *opts.Solved}})
	}
	if opts.Mode != "" {
		filters = append(filters, m{"term": m{"Mode": opts.Mode}})
	}
	if len(opts.Topics) > 0 {
		filters = append(filters, m{"terms": m{"Topic": opts.Topics}})
	}
	if opts.MinRent != nil || opts.MaxRent != nil {
		r := m{}
		if opts.MinRent != nil {
			r["gte"] = *opts.MinRent
		}
		if opts.MaxRent != nil {
			r["lte"] = *opts.MaxRent
		}
		filters = append(filters, m{"range": m{"Rent": r}})
	}
	if opts.AvailableBy != "" {
		filters = append(filters, m{"range": m{"AvailableFrom": m{"lte": opts.AvailableBy}}})
	}
	for field, on := range map[string]bool{"Furnished": opts.Furnished, "Caf": opts.Caf, "Pets": opts.Pets} {
		if on {
			filters = append(filters, m{"term": m{field: true}})
		}
	}
	if len(opts.Employment) > 0 {
		filters = append(filters, m{"terms": m{"Employment": opts.Employment}})
	}
	if opts.MinWage != nil {
		filters = append(filters, m{"term": m{"WageType": "hourly"}}, m{"range": m{"Wage": m{"gte": *opts.MinWage}}})
	}
	if opts.PermitFree {
		filters = append(filters, m{"bool": m{"must_not": m{"term": m{"PermitRequired": true}}}})
	}
	if opts.Near != nil && opts.Near.Km == 0 && opts.Near.AreaId != "" {
		filters = append(filters, m{"term": m{"AreaId": opts.Near.AreaId}})
	} else if opts.Near != nil && opts.Near.Km > 0 {
		filters = append(filters, m{"geo_distance": m{
			"distance": fmt.Sprintf("%gkm", opts.Near.Km),
			"Location": m{"lat": opts.Near.Lat, "lon": opts.Near.Lng},
		}})
	}
	// Community posts have no Deal, so this only drops closed listings.
	if !opts.IncludeClosed {
		filters = append(filters, m{"bool": m{"must_not": m{"term": m{"Deal": "closed"}}}})
	}
	return filters
}

// popular weighs engagement (log scale) against age: a week-old post
// needs clearly more reactions than today's to stay on top.
func popular(query m, replace bool) m {
	boostMode := "multiply"
	if replace {
		boostMode = "replace"
	}
	return m{"function_score": m{
		"query": query,
		"functions": []m{
			{"field_value_factor": m{"field": "Engagement", "modifier": "log2p", "missing": 0}},
			{"gauss": m{"CreatedAt": m{"origin": "now", "offset": "1d", "scale": "7d", "decay": 0.5}}},
		},
		"score_mode": "multiply",
		"boost_mode": boostMode,
	}}
}

func pageBounds(opts PostQuery) (from, size int) {
	size = opts.Size
	if size <= 0 || size > PostPageSize {
		size = PostPageSize
	}
	page := opts.Page
	if page < 1 {
		page = 1
	}
	// ES refuses from+size beyond 10000 (index.max_result_window).
	if (page-1)*size > 10000-size {
		page = (10000-size)/size + 1
	}
	return (page - 1) * size, size
}

func buildPostQuery(opts PostQuery, fuzzy bool) m {
	q := cleanQuery(opts.Q)
	var query m
	if q != "" {
		query = m{"bool": m{"should": textShould(q, postFields, fuzzy), "minimum_should_match": 1, "filter": postFilters(opts)}}
	} else {
		query = m{"bool": m{"filter": postFilters(opts)}}
	}

	from, size := pageBounds(opts)
	body := m{
		"from":             from,
		"size":             size,
		"track_total_hits": true,
		"_source":          []string{"PostId"},
	}
	newest := []m{{"SortAt": m{"order": "desc"}}}
	switch {
	case opts.Sort == "rent_asc":
		body["query"] = query
		body["sort"] = []m{{"Rent": m{"order": "asc", "missing": "_last"}}, newest[0]}
	case opts.Sort == "wage_desc":
		body["query"] = query
		body["sort"] = []m{{"Wage": m{"order": "desc", "missing": "_last"}}, newest[0]}
	case opts.Sort == "available":
		body["query"] = query
		body["sort"] = []m{{"AvailableFrom": m{"order": "asc", "missing": "_last"}}, newest[0]}
	case opts.Sort == "distance" && opts.Near != nil && (opts.Near.Lat != 0 || opts.Near.Lng != 0):
		body["query"] = query
		body["sort"] = []m{{"_geo_distance": m{
			"Location": m{"lat": opts.Near.Lat, "lon": opts.Near.Lng}, "order": "asc", "unit": "km",
		}}, newest[0]}
	case opts.Sort == "popular":
		body["query"] = popular(query, q == "")
	case opts.Sort == "newest" || q == "":
		body["query"] = query
		body["sort"] = newest
	default: // relevance, newer first on ties
		body["query"] = query
		body["sort"] = []m{{"_score": "desc"}, newest[0]}
	}
	return body
}

// buildSimilarQuery matches question titles sharing most of the typed
// words; solved questions rank higher because they hold an answer.
func buildSimilarQuery(title string, size int) m {
	q := cleanQuery(title)
	if len([]rune(q)) < 2 {
		return nil
	}
	if size <= 0 || size > 10 {
		size = 5
	}
	return m{
		"size":    size,
		"_source": []string{"PostId"},
		"query": m{"function_score": m{
			"query": m{"bool": m{
				"should": []m{
					{"match": m{"Title": m{"query": q, "minimum_should_match": "2<60%", "boost": 2}}},
					{"match": m{"Title.compact": m{"query": q, "minimum_should_match": "70%"}}},
				},
				"minimum_should_match": 1,
				"filter":               postFilters(PostQuery{Types: []string{"qna"}}),
			}},
			"functions":  []m{{"filter": m{"term": m{"Solved": true}}, "weight": 1.5}},
			"boost_mode": "multiply",
		}},
	}
}
