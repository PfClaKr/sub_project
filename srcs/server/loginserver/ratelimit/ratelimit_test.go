package ratelimit

import (
	"testing"
	"time"
)

func TestLimiter(t *testing.T) {
	now := time.Unix(0, 0)
	l := New(3, time.Minute)
	l.now = func() time.Time { return now }

	for i := 0; i < 3; i++ {
		if l.Blocked("ip") {
			t.Fatalf("blocked after %d failures, want 3", i)
		}
		l.Fail("ip")
	}
	if !l.Blocked("ip") {
		t.Fatal("want blocked after 3 failures")
	}
	if l.Blocked("other") {
		t.Error("keys must be independent")
	}

	now = now.Add(2 * time.Minute)
	if l.Blocked("ip") {
		t.Error("window expired, want unblocked")
	}

	l.Fail("ip")
	l.Reset("ip")
	if l.Blocked("ip") {
		t.Error("reset must clear failures")
	}
}
