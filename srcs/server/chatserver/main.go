package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"chatserver/sockethandler"

	"local.com/cors"
	"local.com/jwt"

	"github.com/gorilla/mux"
)

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) }).Methods("GET")
	r.Handle("/rooms", jwt.Middleware(http.HandlerFunc(roomsHandler))).Methods("GET")
	r.Handle("/room/product/{productId}", jwt.Middleware(http.HandlerFunc(getOrCreateRoomHandler))).Methods("GET")
	r.Handle("/room/{chatId}", jwt.Middleware(http.HandlerFunc(roomHandler))).Methods("GET")
	r.Handle("/history/{chatId}", jwt.Middleware(http.HandlerFunc(historyHandler))).Methods("GET")
	r.Handle("/ws/{ChatId}", jwt.Middleware(http.HandlerFunc(sockethandler.Sockethandler))).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "9090"
	}

	fmt.Println("Starting chat server on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, cors.Middleware(r)))
}
