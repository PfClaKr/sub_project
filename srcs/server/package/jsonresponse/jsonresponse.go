package jsonresponse

import (
	"net/http"
	"encoding/json"
)

func writeJSONResponse(w http.ResponseWriter, status int, payload interface{}) {
	response, err := json.Marshal(payload)
	if err != nil {
		writeErrorResponse(w, http.StatusInternalServerError, "Failed to marshal JSON response")
		return
	}
	w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:3000")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(response)
}

func writeErrorResponse(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	errorResponse := map[string]string{"error": message}
	json.NewEncoder(w).Encode(errorResponse)
}

func NewPreflight(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "http://127.0.0.1:3000")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	w.Header().Set("Access-Control-Allow-Method", "POST")
	w.Header().Set("Access-Control-Allow-Credentials", "true");
	w.WriteHeader(http.StatusOK)
}

func New(w http.ResponseWriter, status int, payload interface{}) {
	writeJSONResponse(w, status, payload)
}
