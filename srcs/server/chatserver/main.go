package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"chatserver/sockethandler"

	"local.com/account"
	"local.com/cors"
	"local.com/i18n"
	"local.com/jwt"

	"github.com/gorilla/mux"
)

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) }).Methods("GET")
	r.Handle("/rooms", jwt.Middleware(http.HandlerFunc(roomsHandler))).Methods("GET")
	// Starting a conversation and sending messages are writes: suspended
	// members are refused. Reading rooms and history stays open.
	r.Handle("/room/{subjectType}/{subjectId}", jwt.Middleware(account.RequireActive(svc, http.HandlerFunc(getOrCreateRoomHandler)))).Methods("GET")
	r.Handle("/room/{chatId}", jwt.Middleware(http.HandlerFunc(roomHandler))).Methods("GET")
	r.Handle("/history/{chatId}", jwt.Middleware(http.HandlerFunc(historyHandler))).Methods("GET")
	// Blocking stays open to suspended members: it only protects them.
	r.Handle("/blocks", jwt.Middleware(http.HandlerFunc(listBlocksHandler))).Methods("GET")
	r.Handle("/blocks/{userId}", jwt.Middleware(http.HandlerFunc(blockHandler))).Methods("PUT")
	r.Handle("/blocks/{userId}", jwt.Middleware(http.HandlerFunc(unblockHandler))).Methods("DELETE")
	r.Handle("/ws/{ChatId}", jwt.Middleware(account.RequireActive(svc, http.HandlerFunc(sockethandler.Sockethandler)))).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "9090"
	}

	fmt.Println("Starting chat server on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, cors.Middleware(i18n.Middleware(r))))
}
