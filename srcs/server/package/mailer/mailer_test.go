package mailer

import (
	"bytes"
	"io"
	"mime"
	"mime/multipart"
	"net/mail"
	"strings"
	"testing"
)

func TestBuild(t *testing.T) {
	msg := string(build("no-reply@itnyang.test", Message{
		To:      "a@b.c",
		Subject: "[잇냥] 새 댓글",
		Body:    "본문",
		Headers: map[string]string{
			"List-Unsubscribe": "<https://itnyang.test/u?t=1>",
			"X-Evil":           "a\r\nBcc: victim@x.y",
		},
	}))

	if !strings.Contains(msg, "Subject: =?utf-8?b?") {
		t.Errorf("subject is not RFC 2047 encoded:\n%s", msg)
	}
	if !strings.Contains(msg, "List-Unsubscribe: <https://itnyang.test/u?t=1>\r\n") {
		t.Errorf("extra header missing:\n%s", msg)
	}
	if strings.Contains(msg, "Bcc:") {
		t.Errorf("header injection got through:\n%s", msg)
	}
	if !strings.HasSuffix(msg, "\r\n\r\n본문") {
		t.Errorf("body not separated from headers:\n%q", msg)
	}
}

func TestBuildMultipart(t *testing.T) {
	m := Content{Lang: "fr", Heading: "Bonjour", Button: Link{Label: "Vérifier", URL: "https://itnyang.test/v?token=abc"}}.Message("a@b.c", "[Itnyang] Test")
	raw := build("no-reply@itnyang.test", m)

	msg, err := mail.ReadMessage(bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	if from, err := mail.ParseAddress(msg.Header.Get("From")); err != nil || from.Name != "Itnyang" || from.Address != "no-reply@itnyang.test" {
		t.Errorf("From = %q, want the brand as display name", msg.Header.Get("From"))
	}
	ko, _ := mail.ParseAddress(string(bytes.SplitN(bytes.SplitN(build("n@i.t", Content{}.Message("a@b.c", "s")), []byte("From: "), 2)[1], []byte("\r\n"), 2)[0]))
	if ko == nil || ko.Name != "잇냥" {
		t.Errorf("korean From = %+v, want an encoded 잇냥", ko)
	}
	mediaType, params, err := mime.ParseMediaType(msg.Header.Get("Content-Type"))
	if err != nil || mediaType != "multipart/alternative" {
		t.Fatalf("Content-Type = %q (%v)", msg.Header.Get("Content-Type"), err)
	}
	parts := multipart.NewReader(msg.Body, params["boundary"])
	var types, bodies []string
	for {
		p, err := parts.NextPart() // decodes quoted-printable
		if err != nil {
			break
		}
		b, _ := io.ReadAll(p)
		types = append(types, strings.SplitN(p.Header.Get("Content-Type"), ";", 2)[0])
		bodies = append(bodies, string(b))
	}
	if strings.Join(types, ",") != "text/plain,text/html" {
		t.Fatalf("parts = %v, want text then html", types)
	}
	if !strings.Contains(bodies[0], "Vérifier: https://itnyang.test/v?token=abc") {
		t.Errorf("text part = %q", bodies[0])
	}
	if !strings.Contains(bodies[1], `href="https://itnyang.test/v?token=abc"`) || !strings.Contains(bodies[1], `<html lang="fr">`) {
		t.Errorf("html part lacks the link or the language:\n%s", bodies[1])
	}
	for _, line := range strings.Split(string(raw), "\r\n") {
		if len(line) > 998 {
			t.Fatalf("line of %d bytes breaks the SMTP limit", len(line))
		}
	}
}

func TestContentHTML(t *testing.T) {
	c := Content{
		Heading: "냥이님, 잇냥에서 알려드려요.",
		Items: []Item{
			{Title: "새 댓글", Text: `<script>alert(1)</script> & "따옴표"`, Link: Link{Label: "보기", URL: "https://itnyang.test/community/p1#c-1"}},
			{Title: "링크 없는 알림"},
			{Title: "나쁜 링크", Link: Link{Label: "보기", URL: "javascript:alert(1)"}},
		},
		Footer: []Link{{Label: "알림 설정", URL: "https://itnyang.test/myaccount/notifications"}, {Label: "이메일 알림 끄기", URL: "https://itnyang.test/u?u=a&t=b"}},
	}
	html := c.HTML()
	if strings.Contains(html, "<script>") || !strings.Contains(html, "&lt;script&gt;") {
		t.Error("user text must be escaped")
	}
	if strings.Contains(html, "javascript:") {
		t.Error("unsafe link scheme got through")
	}
	for _, want := range []string{`<html lang="ko">`, "냥이님", `href="https://itnyang.test/community/p1#c-1"`, `href="https://itnyang.test/u?u=a&amp;t=b"`, "프랑스 한인 생활 커뮤니티"} {
		if !strings.Contains(html, want) {
			t.Errorf("html lacks %q", want)
		}
	}
	if strings.Contains(html, "버튼이 열리지 않으면") {
		t.Error("no button: the fallback address line must not be shown")
	}
	c.Button = Link{Label: "알림 모두 보기", URL: "https://itnyang.test/notifications"}
	if html := c.HTML(); !strings.Contains(html, "알림 모두 보기") || strings.Contains(html, "버튼이 열리지 않으면") {
		t.Error("a list mail shows its button without the fallback address")
	}

	text := c.Text()
	for _, want := range []string{"■ 새 댓글\n  <script>alert(1)</script>", "  https://itnyang.test/community/p1#c-1\n", "이메일 알림 끄기: https://itnyang.test/u?u=a&t=b\n"} {
		if !strings.Contains(text, want) {
			t.Errorf("text lacks %q:\n%s", want, text)
		}
	}

	en := Content{Lang: "en", Heading: "Hi", Button: Link{Label: "Go", URL: "https://x"}}.HTML()
	if !strings.Contains(en, "paste this address") || !strings.Contains(en, `<a href="https://x" style="color:#0048b4;">https://x</a>`) || !strings.Contains(en, "the Korean community in France") {
		t.Error("the frame is not translated")
	}
}
