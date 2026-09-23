package jwt

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
)

func serve(h http.Handler, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if token != "" {
		req.AddCookie(&http.Cookie{Name: "token", Value: token})
	}
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	return rr
}

func mustNotRun(t *testing.T) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("handler must not run")
	})
}

func TestTokenRoundtrip(t *testing.T) {
	token, err := New("user-1")
	if err != nil {
		t.Fatalf("New: %v", err)
	}

	var gotUser string
	rr := serve(Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotUser = UserID(r.Context())
	})), token)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rr.Code)
	}
	if gotUser != "user-1" {
		t.Errorf("user = %q, want user-1", gotUser)
	}
}

func TestMiddlewareWithoutCookie(t *testing.T) {
	if rr := serve(Middleware(mustNotRun(t)), ""); rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rr.Code)
	}
}

func TestMiddlewareRejectsTamperedToken(t *testing.T) {
	token, _ := New("user-1")
	if rr := serve(Middleware(mustNotRun(t)), token+"x"); rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rr.Code)
	}
}

// Expired tokens must yield 401 so the frontend redirects to login.
func TestMiddlewareRejectsExpiredToken(t *testing.T) {
	claims := &Claims{
		Username: "user-1",
		RegisteredClaims: gojwt.RegisteredClaims{
			ExpiresAt: gojwt.NewNumericDate(time.Now().Add(-time.Minute)),
		},
	}
	token, _ := gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims).SignedString(jwtKey)
	if rr := serve(Middleware(mustNotRun(t)), token); rr.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rr.Code)
	}
}

func TestParseRejectsOtherAlgorithms(t *testing.T) {
	token, _ := gojwt.NewWithClaims(gojwt.SigningMethodHS512, &Claims{Username: "user-1"}).SignedString(jwtKey)
	if _, err := Parse(token); err == nil {
		t.Error("HS512 token must be rejected")
	}
}

func TestOptional(t *testing.T) {
	var got string
	h := Optional(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = UserID(r.Context())
	}))

	if rr := serve(h, ""); rr.Code != http.StatusOK || got != "" {
		t.Errorf("anonymous: status=%d user=%q", rr.Code, got)
	}
	if rr := serve(h, "garbage"); rr.Code != http.StatusOK || got != "" {
		t.Errorf("invalid token: status=%d user=%q", rr.Code, got)
	}
	token, _ := New("user-2")
	if serve(h, token); got != "user-2" {
		t.Errorf("valid token: user=%q, want user-2", got)
	}
}

func TestCookieFlags(t *testing.T) {
	rr := httptest.NewRecorder()
	SetCookie(rr, "abc")
	c := rr.Result().Cookies()[0]
	if !c.HttpOnly || c.SameSite != http.SameSiteLaxMode || c.Secure {
		t.Errorf("unexpected cookie flags: %+v", c)
	}

	t.Setenv("COOKIE_SECURE", "true")
	rr = httptest.NewRecorder()
	SetCookie(rr, "abc")
	if !rr.Result().Cookies()[0].Secure {
		t.Error("COOKIE_SECURE=true must set Secure")
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
