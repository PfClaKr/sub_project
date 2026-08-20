package jwt

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
)

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

type Claims struct {
	Username string `json:"username"`
	jwt.StandardClaims
}

func New(username string) (string, error) {
	expirationTime := time.Now().Add(ExpireDuration())
	claims := &Claims{
		Username: username,
		StandardClaims: jwt.StandardClaims{
			ExpiresAt: expirationTime.Unix(),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(jwtKey)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("token")
		if err != nil {
			if err == http.ErrNoCookie {
				http.Error(w, "No setup cookie", http.StatusUnauthorized)
				return
			}
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}

		tokenString := cookie.Value

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return jwtKey, nil
		})

		if err != nil {
			if err == jwt.ErrSignatureInvalid {
				http.Error(w, "Invalid token signature", http.StatusUnauthorized)
				return
			}
			http.Error(w, "Invalid token", http.StatusBadRequest)
			return
		}

		if !token.Valid {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "claims", claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func getjwt(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["UserId"]
	if userID == "" {
		http.Error(w, "Username is required", http.StatusBadRequest)
		return
	}

	tokenString, err := New(userID)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    tokenString,
		Expires:  time.Now().Add(5 * time.Minute),
		HttpOnly: true,
	})

	response := map[string]string{
		"message": "JWT created",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func Showjwt(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value("claims").(*Claims)
	if !ok {
		http.Error(w, "No claims found in context", http.StatusInternalServerError)
		return
	}

	response := map[string]string{
		"message":  "JWT context",
		"username": claims.Username,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
