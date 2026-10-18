package jsonresponse

import (
	"encoding/json"
	"log"
	"net/http"

	"local.com/i18n"
)

// CORS headers are handled by the cors middleware, not here.
func New(w http.ResponseWriter, status int, payload interface{}) {
	// {"error": ...} bodies (Error, or a map with a code) are translated.
	if m, ok := payload.(map[string]string); ok && m["error"] != "" {
		if lang := i18n.WriterLang(w); lang != i18n.Korean {
			out := make(map[string]string, len(m))
			for k, v := range m {
				out[k] = v
			}
			out["error"] = i18n.Translate(lang, m["error"])
			payload = out
		}
	}
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
// underlying error server-side instead of returning it. Messages are
// written in Korean and go out in the request's language (i18n.Middleware).
func Error(w http.ResponseWriter, status int, message string) {
	New(w, status, map[string]string{"error": message})
}

// Internal logs err and answers a generic 500.
func Internal(w http.ResponseWriter, err error) {
	log.Printf("internal error: %v", err)
	Error(w, http.StatusInternalServerError, "internal error")
}
