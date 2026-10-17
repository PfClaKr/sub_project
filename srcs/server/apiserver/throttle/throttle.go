// Package throttle limits how often one member may do something (post,
// comment, report) within a sliding window. State is in memory, which
// fits the single apiserver instance.
package throttle

import (
	"sync"
	"time"
)

type Limiter struct {
	mu     sync.Mutex
	limit  int
	window time.Duration
	hits   map[string][]time.Time
	now    func() time.Time
}

func New(limit int, window time.Duration) *Limiter {
	return &Limiter{limit: limit, window: window, hits: map[string][]time.Time{}, now: time.Now}
}

// sweepAt bounds memory: past this many keys, idle ones are dropped.
const sweepAt = 10000

// Allow records an attempt for key and reports whether it is within the
// limit. Refused attempts are not recorded.
func (l *Limiter) Allow(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := l.now()
	cutoff := now.Add(-l.window)
	if len(l.hits) > sweepAt {
		for k, times := range l.hits {
			if len(times) == 0 || times[len(times)-1].Before(cutoff) {
				delete(l.hits, k)
			}
		}
	}

	recent := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}
	if len(recent) >= l.limit {
		l.hits[key] = recent
		return false
	}
	l.hits[key] = append(recent, now)
	return true
}
