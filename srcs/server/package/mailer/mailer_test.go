package mailer

import (
	"bytes"
	"encoding/base64"
	"image/png"
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
	// multipart/related: the alternative (text, html), then the logo.
	mediaType, params, err := mime.ParseMediaType(msg.Header.Get("Content-Type"))
	if err != nil || mediaType != "multipart/related" {
		t.Fatalf("Content-Type = %q (%v)", msg.Header.Get("Content-Type"), err)
	}
	related := multipart.NewReader(msg.Body, params["boundary"])
	altPart, err := related.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	altType, altParams, _ := mime.ParseMediaType(altPart.Header.Get("Content-Type"))
	if altType != "multipart/alternative" {
		t.Fatalf("first related part = %q", altType)
	}
	parts := multipart.NewReader(altPart, altParams["boundary"])
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
	logo, err := related.NextPart()
	if err != nil {
		t.Fatal(err)
	}
	data, _ := io.ReadAll(base64.NewDecoder(base64.StdEncoding, logo))
	if logo.Header.Get("Content-ID") != "<"+LogoID+">" || logo.Header.Get("Content-Type") != "image/png" || !bytes.Equal(data, Logo(DefaultTheme.Primary)) {
		t.Errorf("logo part = %v (%d bytes)", logo.Header, len(data))
	}
	if strings.Join(types, ",") != "text/plain,text/html" {
		t.Fatalf("parts = %v, want text then html", types)
	}
	if !strings.Contains(bodies[0], "Vérifier: https://itnyang.test/v?token=abc") {
		t.Errorf("text part = %q", bodies[0])
	}
	if !strings.Contains(bodies[1], `href="https://itnyang.test/v?token=abc"`) || !strings.Contains(bodies[1], `<html lang="fr">`) || !strings.Contains(bodies[1], `src="cid:`+LogoID+`"`) {
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

func TestTheme(t *testing.T) {
	th := ThemeFrom(map[string]string{"primary": "#AA3300", "muted": "grey", "danger": "#000000"})
	if th.Primary != "#aa3300" || th.Muted != DefaultTheme.Muted || th.Heading != DefaultTheme.Heading {
		t.Errorf("theme = %+v", th)
	}

	calls := 0
	themeSource = func() (map[string]string, error) { calls++; return map[string]string{"primary": "#123456"}, nil }
	t.Cleanup(func() { themeSource = nil; ForgetTheme() })
	ForgetTheme()
	_, c := Verification("ko", "https://itnyang.test/v")
	html := c.HTML()
	c.HTML()
	if calls != 1 {
		t.Errorf("theme read %d times, want once (cached)", calls)
	}
	if !strings.Contains(html, `bgcolor="#123456"`) || strings.Contains(html, DefaultTheme.Primary) {
		t.Error("the mail does not use the site theme")
	}
	ForgetTheme()
	themeSource = func() (map[string]string, error) { calls++; return nil, io.ErrUnexpectedEOF }
	if CurrentTheme() != DefaultTheme {
		t.Error("a failed first read must fall back to the built-in colours")
	}
}

func TestLogo(t *testing.T) {
	decode := func(b []byte) func(x, y int) (r, g, b, a uint32) {
		img, err := png.Decode(bytes.NewReader(b))
		if err != nil {
			t.Fatal(err)
		}
		return func(x, y int) (uint32, uint32, uint32, uint32) {
			r, g, b, a := img.At(x, y).RGBA()
			return r >> 8, g >> 8, b >> 8, a >> 8
		}
	}
	orig := decode(logoPNG)
	same := decode(Logo(DefaultTheme.Primary))
	for _, p := range [][2]int{{8, 48}, {48, 48}, {30, 70}, {1, 1}} {
		r1, g1, b1, a1 := orig(p[0], p[1])
		r2, g2, b2, a2 := same(p[0], p[1])
		if diff(r1, r2) > 3 || diff(g1, g2) > 3 || diff(b1, b2) > 3 || a1 != a2 {
			t.Errorf("default colour changed pixel %v: %v → %v", p, []uint32{r1, g1, b1, a1}, []uint32{r2, g2, b2, a2})
		}
	}
	red := decode(Logo("#aa3300"))
	if r, g, b, _ := red(8, 48); diff(r, 0xaa) > 3 || diff(g, 0x33) > 3 || b > 3 {
		t.Errorf("background = %d,%d,%d, want #aa3300", r, g, b)
	}
	if r1, g1, b1, _ := orig(48, 48); r1 > 250 && g1 > 250 && b1 > 250 {
		if r, g, b, _ := red(48, 48); r < 250 || g < 250 || b < 250 {
			t.Errorf("the white cat changed colour: %d,%d,%d", r, g, b)
		}
	}
	if _, _, _, a := red(0, 0); a != 0 {
		t.Error("the rounded corner must stay transparent")
	}
	if !bytes.Equal(Logo("nonsense"), Logo(DefaultTheme.Primary)) {
		t.Error("a bad colour must fall back to the default")
	}
}

func diff(a, b uint32) uint32 {
	if a > b {
		return a - b
	}
	return b - a
}
