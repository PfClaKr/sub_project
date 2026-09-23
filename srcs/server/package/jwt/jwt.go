package jwt

import (
	"context"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

const cookieName = "token"

// JWT_SECRET must be set in production; the fallback is for local dev only.
var jwtKey = []byte(secret())

func secret() string {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return s
	}
	return "local_dev_secret"
}

// ExpireDuration is the token lifetime; JWT_EXPIRE_MINUTES overrides it.
func ExpireDuration() time.Duration {
	if v := os.Getenv("JWT_EXPIRE_MINUTES"); v != "" {
		if m, err := strconv.Atoi(v); err == nil && m > 0 {
			return time.Duration(m) * time.Minute
		}
	}
	return 24 * time.Hour
}

// Claims carries the user id in Username (kept for token compatibility).
type Claims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

func New(userId string) (string, error) {
	claims := &Claims{
		Username: userId,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(ExpireDuration())),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtKey)
}

// Parse validates a token string; only HS256 is accepted.
func Parse(tokenString string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenString, claims, func(*jwt.Token) (interface{}, error) {
		return jwtKey, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil {
		return nil, err
	}
	return claims, nil
}

type ctxKey struct{}

// WithClaims stores claims in ctx; exported for tests of dependent packages.
func WithClaims(ctx context.Context, c *Claims) context.Context {
	return context.WithValue(ctx, ctxKey{}, c)
}

// FromContext returns the claims set by Middleware or Optional.
func FromContext(ctx context.Context) (*Claims, bool) {
	c, ok := ctx.Value(ctxKey{}).(*Claims)
	return c, ok
}

// UserID returns the authenticated user id, or "" when anonymous.
func UserID(ctx context.Context) string {
	if c, ok := FromContext(ctx); ok {
		return c.Username
	}
	return ""
}

func claimsFromRequest(r *http.Request) (*Claims, error) {
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		return nil, err
	}
	return Parse(cookie.Value)
}

// Middleware rejects requests without a valid token with 401.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := claimsFromRequest(r)
		if err != nil {
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(w, r.WithContext(WithClaims(r.Context(), claims)))
	})
}

// Optional attaches claims when a valid token is present and lets
// anonymous requests through; handlers decide what needs auth.
func Optional(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if claims, err := claimsFromRequest(r); err == nil {
			r = r.WithContext(WithClaims(r.Context(), claims))
		}
		next.ServeHTTP(w, r)
	})
}

// COOKIE_SECURE=true marks the cookie Secure (required behind HTTPS).
func secureCookie() bool {
	return os.Getenv("COOKIE_SECURE") == "true"
}

// SetCookie writes the session cookie; lifetime follows the token.
func SetCookie(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    token,
		Path:     "/",
		Expires:  time.Now().Add(ExpireDuration()),
		HttpOnly: true,
		Secure:   secureCookie(),
		SameSite: http.SameSiteLaxMode,
	})
}

// ClearCookie expires the session cookie.
func ClearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secureCookie(),
		SameSite: http.SameSiteLaxMode,
	})
}
