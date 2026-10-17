// Package mailer sends plain-text UTF-8 mail through the configured SMTP
// server: MailHog locally (no auth), SES or another provider in the cloud
// (SMTP_USER/SMTP_PASSWORD, STARTTLS when the server offers it).
package mailer

import (
	"fmt"
	"log"
	"mime"
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

// AppURL is the public site origin used in links, e.g. https://itnyang.fr.
func AppURL() string {
	return strings.TrimRight(env("PUBLIC_APP_URL", "http://localhost:3000"), "/")
}

// Message is one mail. Headers carries extras such as List-Unsubscribe.
type Message struct {
	To      string
	Subject string
	Body    string
	Headers map[string]string
}

// Send is a shortcut for a message without extra headers.
func Send(to, subject, body string) error {
	return SendMessage(Message{To: to, Subject: subject, Body: body})
}

// build renders the RFC 5322 message; the subject is RFC 2047 encoded so
// Korean text survives every mail client.
func build(from string, m Message) []byte {
	headers := []string{
		"From: " + from,
		"To: " + m.To,
		"Subject: " + mime.BEncoding.Encode("utf-8", m.Subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=\"utf-8\"",
		"Content-Transfer-Encoding: 8bit",
	}
	for k, v := range m.Headers {
		// Header injection guard: values come from our own code, but
		// never let a newline through.
		if strings.ContainsAny(k+v, "\r\n") {
			continue
		}
		headers = append(headers, k+": "+v)
	}
	return []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + m.Body)
}

func SendMessage(m Message) error {
	host := env("SMTP_HOST", "mailhog")
	port := env("SMTP_PORT", "1025")
	from := env("SMTP_FROM", "no-reply@itnyang.local")
	user := os.Getenv("SMTP_USER")

	var auth smtp.Auth
	if user != "" {
		auth = smtp.PlainAuth("", user, os.Getenv("SMTP_PASSWORD"), host)
	}

	addr := fmt.Sprintf("%s:%s", host, port)
	if err := smtp.SendMail(addr, auth, from, []string{m.To}, build(from, m)); err != nil {
		log.Printf("failed to send mail to %s: %v", m.To, err)
		return err
	}
	return nil
}
