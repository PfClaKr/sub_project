package cors

import (
	"net/http"
	"os"
	"strings"
)

// FRONTEND_ORIGINS is a comma-separated allowlist.
// Defaults cover local dev via localhost or 127.0.0.1.
func allowedOrigins() []string {
	if v := os.Getenv("FRONTEND_ORIGINS"); v != "" {
		return strings.Split(v, ",")
	}
	return []string{"http://localhost:3000", "http://127.0.0.1:3000"}
}

// IsAllowedOrigin reports whether the origin is in the allowlist.
// Also used for websocket origin checks.
func IsAllowedOrigin(origin string) bool {
	for _, allowed := range allowedOrigins() {
		if strings.TrimSpace(allowed) == origin {
			return true
		}
	}
	return false
}

// Middleware sets CORS headers for allowlisted origins and
// short-circuits preflight requests.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if IsAllowedOrigin(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
