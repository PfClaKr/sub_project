// Package ratelimit counts failed attempts per key in a fixed window.
// In-memory: fine for a single loginserver instance.
package ratelimit

import (
	"sync"
	"time"
)

type entry struct {
	count int
	start time.Time
}

type Limiter struct {
	mu      sync.Mutex
	max     int
	window  time.Duration
	entries map[string]*entry
	now     func() time.Time
}

func New(max int, window time.Duration) *Limiter {
	return &Limiter{max: max, window: window, entries: map[string]*entry{}, now: time.Now}
}

// Blocked reports whether key used up its failures in the current window.
func (l *Limiter) Blocked(key string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	e := l.entries[key]
	if e == nil || l.now().Sub(e.start) > l.window {
		return false
	}
	return e.count >= l.max
}

// Fail records a failed attempt.
func (l *Limiter) Fail(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if len(l.entries) > 10000 {
		l.prune(now)
	}
	e := l.entries[key]
	if e == nil || now.Sub(e.start) > l.window {
		l.entries[key] = &entry{count: 1, start: now}
		return
	}
	e.count++
}

// Reset clears key after a successful attempt.
func (l *Limiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.entries, key)
}

func (l *Limiter) prune(now time.Time) {
	for k, e := range l.entries {
		if now.Sub(e.start) > l.window {
			delete(l.entries, k)
		}
	}
}
