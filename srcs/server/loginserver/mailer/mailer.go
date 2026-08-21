package mailer

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// Send delivers a UTF-8 mail through the configured SMTP server.
// Locally this is MailHog (no auth); in the cloud set SMTP_USER/SMTP_PASSWORD.
func Send(to, subject, body string) error {
	host := env("SMTP_HOST", "mailhog")
	port := env("SMTP_PORT", "1025")
	from := env("SMTP_FROM", "no-reply@itnyang.local")
	user := os.Getenv("SMTP_USER")
	password := os.Getenv("SMTP_PASSWORD")

	headers := []string{
		"From: " + from,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=\"utf-8\"",
	}
	msg := strings.Join(headers, "\r\n") + "\r\n\r\n" + body

	var auth smtp.Auth
	if user != "" {
		auth = smtp.PlainAuth("", user, password, host)
	}

	addr := fmt.Sprintf("%s:%s", host, port)
	if err := smtp.SendMail(addr, auth, from, []string{to}, []byte(msg)); err != nil {
		log.Printf("failed to send mail to %s: %v", to, err)
		return err
	}
	return nil
}

// SendVerification mails the account activation link.
func SendVerification(to, token string) error {
	appURL := env("PUBLIC_APP_URL", "http://localhost:3000")
	link := fmt.Sprintf("%s/account/verify?token=%s", appURL, token)
	body := fmt.Sprintf(
		"잇냥에 가입해주셔서 감사합니다!\n\n아래 링크를 눌러 이메일 인증을 완료해주세요.\n\n%s\n\n본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.\n",
		link,
	)
	return Send(to, "[잇냥] 이메일 인증을 완료해주세요", body)
}
