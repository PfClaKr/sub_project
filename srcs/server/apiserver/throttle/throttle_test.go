package throttle

import (
	"testing"
	"time"
)

func TestAllow(t *testing.T) {
	clock := time.Unix(0, 0)
	l := New(2, time.Minute)
	l.now = func() time.Time { return clock }

	if !l.Allow("a") || !l.Allow("a") {
		t.Fatal("first two attempts must pass")
	}
	if l.Allow("a") {
		t.Error("third attempt within the window must be refused")
	}
	if !l.Allow("b") {
		t.Error("keys are independent")
	}
	clock = clock.Add(61 * time.Second)
	if !l.Allow("a") {
		t.Error("attempts older than the window must not count")
	}
}
