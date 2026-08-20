package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"loginserver/emailhandler"
	"loginserver/loginhandler"
	"loginserver/signuphandler"

	"local.com/cors"

	"github.com/gorilla/mux"
)

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/login", loginhandler.LoginHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/signup", signuphandler.SignupHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/emailcheck", emailhandler.EmailcheckHandler).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "7070"
	}

	fmt.Println("Starting login server on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, cors.Middleware(r)))
}
