package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"loginserver/emailhandler"
	"loginserver/loginhandler"
	"loginserver/sessionhandler"
	"loginserver/signuphandler"

	"local.com/cors"
	"local.com/jwt"

	"github.com/gorilla/mux"
)

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/login", loginhandler.LoginHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/signup", signuphandler.SignupHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/emailcheck", emailhandler.EmailcheckHandler).Methods("GET")
	r.Handle("/whoami", jwt.Middleware(http.HandlerFunc(sessionhandler.WhoamiHandler))).Methods("GET")
	r.HandleFunc("/logout", sessionhandler.LogoutHandler).Methods("POST", "OPTIONS")

	port := os.Getenv("PORT")
	if port == "" {
		port = "7070"
	}

	fmt.Println("Starting login server on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, cors.Middleware(r)))
}
