package loginhandler

import (
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	r := httptest.NewRequest("POST", "/login", nil)
	r.RemoteAddr = "172.18.0.5:41234"
	r.Header.Set("X-Forwarded-For", "6.6.6.6, 203.0.113.9")

	if got := clientIP(r); got != "172.18.0.5" {
		t.Errorf("without TRUST_PROXY got %q, want the peer address", got)
	}

	t.Setenv("TRUST_PROXY", "true")
	// The last entry is the one the proxy appended; earlier ones are
	// client-controlled and must not be used as the limiter key.
	if got := clientIP(r); got != "203.0.113.9" {
		t.Errorf("with TRUST_PROXY got %q, want 203.0.113.9", got)
	}

	r.Header.Del("X-Forwarded-For")
	if got := clientIP(r); got != "172.18.0.5" {
		t.Errorf("no header got %q, want the peer address", got)
	}
}
