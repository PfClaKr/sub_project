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
	w.Header().Set("Access-Control-Allow-Origin", "*")
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

func New(w http.ResponseWriter, status int, payload interface{}) {
	writeJSONResponse(w, status, payload)
}
