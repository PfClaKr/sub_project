package jsonresponse

import (
	"encoding/json"
	"log"
	"net/http"
)

// CORS headers are handled by the cors middleware, not here.
func New(w http.ResponseWriter, status int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		log.Printf("jsonresponse: marshal failed: %v", err)
		status = http.StatusInternalServerError
		response = []byte(`{"error":"internal error"}`)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(response)
}

// Error writes {"error": message}. Keep messages user-safe; log the
// underlying error server-side instead of returning it.
func Error(w http.ResponseWriter, status int, message string) {
	New(w, status, map[string]string{"error": message})
}

// Internal logs err and answers a generic 500.
func Internal(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	Error(w, http.StatusInternalServerError, "internal error")
}
