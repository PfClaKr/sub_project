package eshandler

// PostQuery selects and orders community posts.
type PostQuery struct {
	Q       string
	Types   []string // e.g. ["free", "qna"]; empty means any
	Topic   string
	City    string
	Country string
	Solved  *bool // Q&A: only solved / only open questions
	// Sort: "newest" (default without Q), "popular", or "" for relevance
	// when Q is set.
	Sort string
	Page int // 1-based
	Size int
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
	newest := []m{{"CreatedAt": m{"order": "desc"}}}
	switch {
	case opts.Sort == "popular":
		body["query"] = popular(query, q == "")
	case opts.Sort == "newest" || q == "":
		body["query"] = query
		body["sort"] = newest
	default: // relevance, newer first on ties
		body["query"] = query
		body["sort"] = []m{{"_score": "desc"}, {"CreatedAt": m{"order": "desc"}}}
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
