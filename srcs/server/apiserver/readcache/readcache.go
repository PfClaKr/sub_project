// Package readcache keeps items that lists read over and over (authors'
// nicknames, the posts and products a list shows) in memory for a while.
// DynamoDB on-demand bills every read, and a popular list page otherwise
// rereads the same items for every visitor: in the beta simulation these
// batch reads were about 85% of all read units.
//
// Writes in this process Forget the item at once, so members see their
// own changes immediately; what changes elsewhere (view counters, another
// service) shows up within the TTL.
package readcache

import (
	"sync"
	"sync/atomic"
	"time"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
)

type entry struct {
	item dynamo.Item
	at   time.Time
}

// Cache holds items of one table, read with one projection.
type Cache struct {
	table, key, projection string
	ttl                    time.Duration
	max                    int
	now                    func() time.Time

	mu      sync.Mutex
	entries map[string]entry

	Hits, Misses atomic.Int64
}

// New caches items of table (partition key key) for ttl, at most max of
// them. projection "" keeps whole items.
func New(table, key, projection string, ttl time.Duration, max int) *Cache {
	return &Cache{table: table, key: key, projection: projection, ttl: ttl, max: max, now: time.Now, entries: map[string]entry{}}
}

// BatchGet is dynamo.BatchGet through the cache: only missing or expired
// ids are read. Items are copies, so callers may change them.
func (c *Cache) BatchGet(svc dynamodbiface.DynamoDBAPI, ids []string) (map[string]dynamo.Item, error) {
	out := map[string]dynamo.Item{}
	var missing []string
	now := c.now()
	c.mu.Lock()
	for _, id := range ids {
		if id == "" {
			continue
		}
		if e, ok := c.entries[id]; ok && now.Sub(e.at) < c.ttl {
			out[id] = copyItem(e.item)
			continue
		}
		missing = append(missing, id)
	}
	c.mu.Unlock()
	c.Hits.Add(int64(len(out)))
	if len(missing) == 0 {
		return out, nil
	}
	c.Misses.Add(int64(len(missing)))
	found, err := dynamo.BatchGet(svc, c.table, c.key, missing, c.projection)
	if err != nil {
		return nil, err
	}
	c.mu.Lock()
	if len(c.entries)+len(found) > c.max {
		c.prune(now)
	}
	for id, item := range found {
		c.entries[id] = entry{item: item, at: now}
		out[id] = copyItem(item)
	}
	c.mu.Unlock()
	return out, nil
}

// Forget drops ids after a write, so the next read goes to DynamoDB.
func (c *Cache) Forget(ids ...string) {
	c.mu.Lock()
	for _, id := range ids {
		delete(c.entries, id)
	}
	c.mu.Unlock()
}

// prune drops expired entries, or everything when that is not enough
// (a simple bound; the cache refills from the next reads).
func (c *Cache) prune(now time.Time) {
	for id, e := range c.entries {
		if now.Sub(e.at) >= c.ttl {
			delete(c.entries, id)
		}
	}
	if len(c.entries) >= c.max {
		c.entries = map[string]entry{}
	}
}

func copyItem(item dynamo.Item) dynamo.Item {
	out := make(dynamo.Item, len(item))
	for k, v := range item {
		out[k] = v
	}
	return out
}
