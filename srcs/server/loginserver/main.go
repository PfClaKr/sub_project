package main

import(
    "fmt"
    "net/http"
	"log"

	"loginserver/loginhandler"
	"loginserver/signinhandler"
	"loginserver/emailhandler"

	"github.com/gorilla/mux"
)

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/login", loginhandler.LoginHandler).Methods("GET")
	r.HandleFunc("/signin", signinhandler.SigninHandler).Methods("POST")
	r.HandleFunc("/emailcheck", emailhandler.EmailcheckHandler).Methods("GET")

	fmt.Println("Starting login server on :7070")
	log.Fatal(http.ListenAndServe(":7070", r))
}