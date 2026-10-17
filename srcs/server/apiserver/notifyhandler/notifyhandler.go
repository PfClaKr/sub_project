// Package notifyhandler serves the REST side of notifications: the
// email unsubscribe link and web push subscriptions.
package notifyhandler

import (
	"encoding/json"
	"errors"
	"net/http"

	"local.com/dynamo"
	"local.com/jsonresponse"
	"local.com/jwt"
	"local.com/notify"

	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/gorilla/mux"
)

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

// Register mounts the routes. Subscriptions need a login; unsubscribing
// is proven by the signed link instead.
func Register(r *mux.Router) {
	r.HandleFunc("/notifications/unsubscribe", unsubscribeHandler).Methods("POST")
	r.HandleFunc("/push/key", keyHandler).Methods("GET")
	r.Handle("/push/subscription", jwt.Middleware(http.HandlerFunc(subscribeHandler))).Methods("POST")
	r.Handle("/push/subscription", jwt.Middleware(http.HandlerFunc(unsubscribePushHandler))).Methods("DELETE")
}

// unsubscribeHandler turns off email for the member in the link. Mail
// clients post here directly (RFC 8058 one-click, u and t in the query);
// the site's unsubscribe page posts the same parameters as JSON.
func unsubscribeHandler(w http.ResponseWriter, r *http.Request) {
	userId, token := r.URL.Query().Get("u"), r.URL.Query().Get("t")
	if userId == "" {
		var body struct{ U, T string }
		json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body)
		userId, token = body.U, body.T
	}
	if !notify.Unsubscribe(svc, userId, token) {
		jsonresponse.Error(w, http.StatusBadRequest, "수신 거부 링크가 올바르지 않아요.")
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"Unsubscribed": true})
}

func keyHandler(w http.ResponseWriter, r *http.Request) {
	jsonresponse.New(w, http.StatusOK, map[string]interface{}{"Enabled": notify.PushConfigured(), "PublicKey": notify.PublicKey()})
}

func subscribeHandler(w http.ResponseWriter, r *http.Request) {
	if !notify.PushConfigured() {
		jsonresponse.Error(w, http.StatusServiceUnavailable, "푸시 알림이 아직 준비되지 않았어요.")
		return
	}
	var sub notify.Subscription
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8192)).Decode(&sub); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	switch err := notify.SaveSubscription(svc, jwt.UserID(r.Context()), sub); {
	case errors.Is(err, notify.ErrBadSubscription):
		jsonresponse.Error(w, http.StatusBadRequest, "푸시 구독 정보가 올바르지 않아요.")
	case err != nil:
		jsonresponse.Internal(w, err)
	default:
		jsonresponse.New(w, http.StatusCreated, map[string]bool{"Subscribed": true})
	}
}

func unsubscribePushHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Endpoint string `json:"endpoint"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&body); err != nil || body.Endpoint == "" {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	if err := notify.DeleteSubscription(svc, jwt.UserID(r.Context()), body.Endpoint); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"Subscribed": false})
}
