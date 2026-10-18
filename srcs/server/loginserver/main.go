package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"loginserver/emailhandler"
	"loginserver/googlehandler"
	"loginserver/loginhandler"
	"loginserver/passwordhandler"
	"loginserver/sessionhandler"
	"loginserver/signuphandler"
	"loginserver/verifyhandler"

	"local.com/cors"
	"local.com/i18n"
	"local.com/jwt"
	"local.com/mailer"

	"github.com/gorilla/mux"
)

func main() {
	// make demo: docker compose exec loginserver /main demo-account <email> <password> <nickname>
	if len(os.Args) == 5 && os.Args[1] == "demo-account" {
		req := signuphandler.SignupRequest{Email: os.Args[2], Password: os.Args[3], UserNickname: os.Args[4], Agree: true}
		userId, err := signuphandler.EnsureDemoAccount(req, 30)
		if err != nil {
			log.Fatalf("demo account %s: %v", os.Args[2], err)
		}
		fmt.Println(userId)
		return
	}

	// Mails follow the theme colours set on /admin/site.
	mailer.UseSiteTheme()

	r := mux.NewRouter()
	r.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) }).Methods("GET")
	r.HandleFunc("/login", loginhandler.LoginHandler).Methods("POST")
	r.HandleFunc("/signup", signuphandler.SignupHandler).Methods("POST")
	r.HandleFunc("/emailcheck", emailhandler.EmailcheckHandler).Methods("GET")
	r.Handle("/whoami", jwt.Middleware(http.HandlerFunc(sessionhandler.WhoamiHandler))).Methods("GET")
	r.HandleFunc("/logout", sessionhandler.LogoutHandler).Methods("POST")

	passwordhandler.ClientIP = loginhandler.ClientIP
	r.HandleFunc("/password/forgot", passwordhandler.ForgotHandler).Methods("POST")
	r.HandleFunc("/password/reset", passwordhandler.ResetHandler).Methods("POST")
	r.Handle("/password/change", jwt.Middleware(http.HandlerFunc(passwordhandler.ChangeHandler))).Methods("POST")

	r.HandleFunc("/verify", verifyhandler.VerifyHandler).Methods("GET")
	r.HandleFunc("/verify/resend", verifyhandler.ResendHandler).Methods("POST")

	r.HandleFunc("/auth/google/status", googlehandler.StatusHandler).Methods("GET")
	r.HandleFunc("/auth/google/login", googlehandler.LoginHandler).Methods("GET")
	r.HandleFunc("/auth/google/callback", googlehandler.CallbackHandler).Methods("GET")

	port := os.Getenv("PORT")
	if port == "" {
		port = "7070"
	}

	fmt.Println("Starting login server on :" + port)
	log.Fatal(http.ListenAndServe(":"+port, cors.Middleware(i18n.Middleware(r))))
}
