// Package mailer sends UTF-8 mail (plain text, or text plus HTML built
// from a Content) through the configured SMTP server: MailHog locally (no auth), SES or another provider in the cloud
// (SMTP_USER/SMTP_PASSWORD, STARTTLS when the server offers it).
package mailer

import (
	"bytes"
	"fmt"
	"log"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"os"
	"strings"
	"time"
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

// Message is one mail. Body is the plain text; with HTML set the mail is
// multipart/alternative and clients show the HTML. FromName is the
// sender's display name. Headers carries extras such as List-Unsubscribe.
type Message struct {
	To       string
	Subject  string
	Body     string
	HTML     string
	FromName string
	Headers  map[string]string
}

// Send is a shortcut for a message without extra headers.
func Send(to, subject, body string) error {
	return SendMessage(Message{To: to, Subject: subject, Body: body})
}

// build renders the RFC 5322 message; the subject and the sender name
// are RFC 2047 encoded so Korean text survives every mail client.
func build(from string, m Message) []byte {
	sender := from
	if m.FromName != "" && !strings.Contains(from, "<") {
		sender = (&mail.Address{Name: m.FromName, Address: from}).String()
	}
	headers := []string{
		"From: " + sender,
		"To: " + m.To,
		"Subject: " + mime.BEncoding.Encode("utf-8", m.Subject),
		"Date: " + time.Now().Format(time.RFC1123Z),
		"MIME-Version: 1.0",
	}
	for k, v := range m.Headers {
		// Header injection guard: values come from our own code, but
		// never let a newline through.
		if strings.ContainsAny(k+v, "\r\n") {
			continue
		}
		headers = append(headers, k+": "+v)
	}
	if m.HTML == "" {
		headers = append(headers, "Content-Type: text/plain; charset=\"utf-8\"", "Content-Transfer-Encoding: 8bit")
		return []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + m.Body)
	}

	// Text first, HTML last: clients show the last part they support.
	// The text stays 8bit (readable as is, links unencoded); the HTML is
	// quoted-printable so its long lines stay under the SMTP limit.
	var body bytes.Buffer
	parts := multipart.NewWriter(&body)
	text, _ := parts.CreatePart(textproto.MIMEHeader{
		"Content-Type":              {"text/plain; charset=\"utf-8\""},
		"Content-Transfer-Encoding": {"8bit"},
	})
	text.Write([]byte(m.Body))
	html, _ := parts.CreatePart(textproto.MIMEHeader{
		"Content-Type":              {"text/html; charset=\"utf-8\""},
		"Content-Transfer-Encoding": {"quoted-printable"},
	})
	qp := quotedprintable.NewWriter(html)
	qp.Write([]byte(m.HTML))
	qp.Close()
	parts.Close()
	headers = append(headers, "Content-Type: multipart/alternative; boundary=\""+parts.Boundary()+"\"")
	return []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + body.String())
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
