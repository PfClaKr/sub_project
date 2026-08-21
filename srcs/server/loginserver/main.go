package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"loginserver/emailhandler"
	"loginserver/googlehandler"
	"loginserver/loginhandler"
	"loginserver/sessionhandler"
	"loginserver/signuphandler"
	"loginserver/verifyhandler"

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

	r.HandleFunc("/verify", verifyhandler.VerifyHandler).Methods("GET")
	r.HandleFunc("/verify/resend", verifyhandler.ResendHandler).Methods("POST", "OPTIONS")

	r.HandleFunc("/auth/google/status", googlehandler.StatusHandler).Methods("GET")
	r.HandleFunc("/auth/google/login", googlehandler.LoginHandler).Methods("GET")
	r.HandleFunc("/auth/google/callback", googlehandler.CallbackHandler).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "7070"
	}

	fmt.Println("Starting login server on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, cors.Middleware(r)))
}
