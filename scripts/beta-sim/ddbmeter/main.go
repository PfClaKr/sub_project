// ddbmeter sits between the services and DynamoDB Local during the beta
// simulation (scripts/beta-sim). It asks DynamoDB for ConsumedCapacity on
// every call and adds the capacity units up per operation and table, which
// is what on-demand billing counts (read and write request units).
//
//	GET  /__stats  totals since the last reset
//	POST /__reset  start counting again
package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"sort"
	"strings"
	"sync"
)

// Operations that accept ReturnConsumedCapacity, and whether they write.
var capacityOps = map[string]bool{
	"GetItem": false, "Query": false, "Scan": false, "BatchGetItem": false, "TransactGetItems": false,
	"PutItem": true, "UpdateItem": true, "DeleteItem": true, "BatchWriteItem": true, "TransactWriteItems": true,
}

type stat struct {
	Op        string
	Table     string
	Write     bool
	Calls     int64
	Units     float64
	RespBytes int64
}

var (
	mu    sync.Mutex
	stats = map[string]*stat{}
)

type consumed struct {
	TableName     string
	CapacityUnits float64
}

func record(op string, write bool, req map[string]interface{}, resp []byte) {
	var single struct{ ConsumedCapacity *consumed }
	var many struct{ ConsumedCapacity []consumed }
	var entries []consumed
	if json.Unmarshal(resp, &single) == nil && single.ConsumedCapacity != nil {
		entries = []consumed{*single.ConsumedCapacity}
	} else if json.Unmarshal(resp, &many) == nil {
		entries = many.ConsumedCapacity
	}
	if len(entries) == 0 {
		table, _ := req["TableName"].(string)
		entries = []consumed{{TableName: table}}
	}
	mu.Lock()
	defer mu.Unlock()
	for i, e := range entries {
		key := op + " " + e.TableName
		s := stats[key]
		if s == nil {
			s = &stat{Op: op, Table: e.TableName, Write: write}
			stats[key] = s
		}
		if i == 0 {
			s.Calls++
			s.RespBytes += int64(len(resp))
		}
		s.Units += e.CapacityUnits
	}
}

func main() {
	upstream, err := url.Parse(env("UPSTREAM", "http://dynamodb:8000"))
	if err != nil {
		log.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(upstream)

	http.HandleFunc("/__stats", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		out := make([]*stat, 0, len(stats))
		for _, s := range stats {
			c := *s
			out = append(out, &c)
		}
		mu.Unlock()
		sort.Slice(out, func(i, j int) bool { return out[i].Units > out[j].Units })
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(out)
	})
	http.HandleFunc("/__reset", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		stats = map[string]*stat{}
		mu.Unlock()
	})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		op := r.Header.Get("X-Amz-Target")
		op = op[strings.LastIndex(op, ".")+1:]
		write, metered := capacityOps[op]
		if !metered {
			proxy.ServeHTTP(w, r)
			return
		}
		body, _ := io.ReadAll(r.Body)
		var req map[string]interface{}
		if json.Unmarshal(body, &req) == nil {
			// DynamoDB Local does not check signatures, so the body can
			// change under the SigV4 header.
			if _, set := req["ReturnConsumedCapacity"]; !set {
				req["ReturnConsumedCapacity"] = "TOTAL"
				body, _ = json.Marshal(req)
			}
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		r.ContentLength = int64(len(body))
		r.Header.Del("Content-Length")
		rec := &recorder{ResponseWriter: w}
		proxy.ServeHTTP(rec, r)
		record(op, write, req, rec.buf.Bytes())
	})
	log.Println("ddbmeter on :8000 →", upstream)
	log.Fatal(http.ListenAndServe(":8000", nil))
}

// recorder copies the response through unchanged (the SDK checks its
// CRC32) and keeps a copy to read ConsumedCapacity from.
type recorder struct {
	http.ResponseWriter
	buf bytes.Buffer
}

func (r *recorder) Write(p []byte) (int, error) {
	r.buf.Write(p)
	return r.ResponseWriter.Write(p)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
