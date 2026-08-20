package jwt

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestTokenRoundtrip(t *testing.T) {
	token, err := New("user-1")
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	var gotUser string
	handler := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := r.Context().Value("claims").(*Claims)
		if !ok {
			t.Fatal("claims missing from context")
		}
		gotUser = claims.Username
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "token", Value: token})
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	if gotUser != "user-1" {
		t.Errorf("username = %q, want user-1", gotUser)
	}
}

func TestMiddlewareWithoutCookie(t *testing.T) {
	handler := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler must not run without a token")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rr.Code)
	}
}

func TestMiddlewareRejectsTamperedToken(t *testing.T) {
	token, _ := New("user-1")
	handler := Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler must not run with a tampered token")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "token", Value: token + "x"})
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if rr.Code == http.StatusOK {
		t.Error("tampered token must be rejected")
	}
}

func TestExpireDuration(t *testing.T) {
	if got := ExpireDuration(); got != 24*time.Hour {
		t.Errorf("default = %v, want 24h", got)
	}
	t.Setenv("JWT_EXPIRE_MINUTES", "90")
	if got := ExpireDuration(); got != 90*time.Minute {
		t.Errorf("env override = %v, want 90m", got)
	}
	t.Setenv("JWT_EXPIRE_MINUTES", "bogus")
	if got := ExpireDuration(); got != 24*time.Hour {
		t.Errorf("invalid env = %v, want 24h fallback", got)
	}
}
