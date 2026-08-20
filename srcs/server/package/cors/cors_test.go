package cors

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestIsAllowedOriginDefaults(t *testing.T) {
	if !IsAllowedOrigin("http://localhost:3000") {
		t.Error("default allowlist should accept http://localhost:3000")
	}
	if !IsAllowedOrigin("http://127.0.0.1:3000") {
		t.Error("default allowlist should accept http://127.0.0.1:3000")
	}
	if IsAllowedOrigin("http://evil.example.com") {
		t.Error("unknown origin must be rejected")
	}
	if IsAllowedOrigin("") {
		t.Error("empty origin must be rejected")
	}
}

func TestIsAllowedOriginEnvOverride(t *testing.T) {
	t.Setenv("FRONTEND_ORIGINS", "https://itnyang.example, https://www.itnyang.example")
	if !IsAllowedOrigin("https://www.itnyang.example") {
		t.Error("env allowlist entry should be accepted (with surrounding spaces trimmed)")
	}
	if IsAllowedOrigin("http://localhost:3000") {
		t.Error("defaults must not apply when FRONTEND_ORIGINS is set")
	}
}

func TestMiddlewarePreflight(t *testing.T) {
	nextCalled := false
	handler := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
	}))

	req := httptest.NewRequest(http.MethodOptions, "/login", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if nextCalled {
		t.Error("preflight must not reach the next handler")
	}
	if rr.Code != http.StatusOK {
		t.Errorf("preflight status = %d, want 200", rr.Code)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Errorf("Allow-Origin = %q", got)
	}
	if rr.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Error("Allow-Credentials must be true for allowlisted origins")
	}
}

func TestMiddlewarePassthrough(t *testing.T) {
	nextCalled := false
	handler := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
	}))

	req := httptest.NewRequest(http.MethodGet, "/rooms", nil)
	req.Header.Set("Origin", "http://unknown.example")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if !nextCalled {
		t.Error("non-preflight request must reach the next handler")
	}
	if rr.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("unknown origin must not receive CORS headers")
	}
}
