package mailer

import (
	"bytes"
	"fmt"
	"html/template"
	"strings"

	"local.com/i18n"
)

// Link is a labelled URL: the call-to-action button, an item's link, a
// footer link.
type Link struct {
	Label string
	URL   string
}

// Item is one entry of a list mail, such as a notification in a digest.
type Item struct {
	Title string
	Text  string // user content allowed: the HTML is escaped
	Link  Link
}

// Content is what a mail says, written once and rendered twice: as the
// plain-text part and as the HTML part of a multipart/alternative
// message. Callers pass translated text; the frame (brand, fallback
// link, footer) is translated here from Lang.
type Content struct {
	Lang      string
	Preheader string // inbox preview line, hidden in the body
	Heading   string
	Intro     []string
	Items     []Item
	Button    Link     // without Items, its address is also printed for clients that break buttons
	Notes     []string // small print under the button
	Footer    []Link   // e.g. notification settings, unsubscribe
}

// Message is the mail for content: text and HTML parts, and the brand
// as the sender's display name.
func (c Content) Message(to, subject string) Message {
	return Message{
		To:       to,
		Subject:  subject,
		Body:     c.Text(),
		HTML:     c.HTML(),
		FromName: i18n.T(c.Lang, "잇냥"),
	}
}

// Text is the plain-text version, for clients that do not show HTML.
func (c Content) Text() string {
	var b strings.Builder
	b.WriteString(c.Heading + "\n\n")
	for _, p := range c.Intro {
		b.WriteString(p + "\n\n")
	}
	for _, it := range c.Items {
		fmt.Fprintf(&b, "■ %s\n", it.Title)
		if it.Text != "" {
			fmt.Fprintf(&b, "  %s\n", it.Text)
		}
		if it.Link.URL != "" {
			fmt.Fprintf(&b, "  %s\n", it.Link.URL)
		}
		b.WriteString("\n")
	}
	if c.Button.URL != "" {
		fmt.Fprintf(&b, "%s: %s\n\n", c.Button.Label, c.Button.URL)
	}
	for _, p := range c.Notes {
		b.WriteString(p + "\n\n")
	}
	for _, l := range c.Footer {
		fmt.Fprintf(&b, "%s: %s\n", l.Label, l.URL)
	}
	if len(c.Footer) > 0 {
		b.WriteString("\n")
	}
	fmt.Fprintf(&b, "%s · %s\n%s\n", i18n.T(c.Lang, "잇냥"), i18n.T(c.Lang, "프랑스 한인 생활 커뮤니티"), AppURL())
	return b.String()
}

// HTML is the designed version: a centred card on a soft background,
// tables and inline styles only, since mail clients drop most CSS.
func (c Content) HTML() string {
	lang := c.Lang
	if !i18n.Valid(lang) {
		lang = i18n.Korean
	}
	var b bytes.Buffer
	err := layout.Execute(&b, map[string]interface{}{
		"C":        c,
		"Lang":     lang,
		"AppURL":   AppURL(),
		"Brand":    i18n.T(lang, "잇냥"),
		"Tagline":  i18n.T(lang, "프랑스 한인 생활 커뮤니티"),
		"Fallback": i18n.T(lang, "버튼이 열리지 않으면 이 주소를 브라우저에 붙여 넣으세요."),
		"NoReply":  i18n.T(lang, "발신 전용 메일이라 답장은 확인하지 못해요."),
	})
	if err != nil {
		// The template is fixed and the data plain strings: this cannot
		// happen, and the text part still carries the message.
		return ""
	}
	return b.String()
}

// Brand colours from the site's theme (frontend theme/colorPalette.ts).
var layout = template.Must(template.New("mail").Parse(`<!doctype html>
<html lang="{{.Lang}}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{{.C.Heading}}</title>
<style>
@media (max-width: 600px) {
  .outer { padding: 20px 10px !important; }
  .card { padding: 28px 20px !important; }
  .button { width: 100% !important; }
  .button a { display: block !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#f2f5fa;-webkit-text-size-adjust:100%;">
{{if .C.Preheader}}<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f2f5fa;">{{.C.Preheader}}</div>{{end}}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f2f5fa;">
<tr><td align="center" class="outer" style="padding:36px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR','Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="padding:0 4px 18px;">
<a href="{{.AppURL}}" style="text-decoration:none;color:#0048b4;font-size:20px;font-weight:800;letter-spacing:-0.3px;">
<img src="{{.AppURL}}/icons/icon-192.png" width="32" height="32" alt="" style="width:32px;height:32px;border:0;border-radius:9px;vertical-align:middle;">
<span style="vertical-align:middle;padding-left:6px;">{{.Brand}}</span>
</a>
</td></tr>
<tr><td class="card" style="background:#ffffff;border:1px solid #e2e8f2;border-radius:18px;padding:36px 32px;color:#1f2937;">
<h1 style="margin:0 0 14px;font-size:22px;line-height:1.4;font-weight:800;color:#111827;letter-spacing:-0.3px;">{{.C.Heading}}</h1>
{{range .C.Intro}}<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">{{.}}</p>
{{end}}
{{range .C.Items}}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;">
<tr><td style="background:#f4f8fe;border-left:4px solid #0048b4;border-radius:10px;padding:14px 16px;">
<div style="font-size:15px;line-height:1.5;font-weight:700;color:#111827;">{{.Title}}</div>
{{if .Text}}<div style="margin-top:4px;font-size:14px;line-height:1.6;color:#4b5563;">{{.Text}}</div>{{end}}
{{if .Link.URL}}<div style="margin-top:8px;"><a href="{{.Link.URL}}" style="font-size:14px;font-weight:700;color:#0048b4;text-decoration:none;">{{.Link.Label}} &rarr;</a></div>{{end}}
</td></tr>
</table>
{{end}}
{{if .C.Button.URL}}<table role="presentation" class="button" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 20px;">
<tr><td align="center" bgcolor="#0048b4" style="border-radius:12px;">
<a href="{{.C.Button.URL}}" style="display:inline-block;padding:14px 30px;font-size:16px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">{{.C.Button.Label}}</a>
</td></tr>
</table>
{{if not .C.Items}}<p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#6b7280;">{{.Fallback}}</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;word-break:break-all;"><a href="{{.C.Button.URL}}" style="color:#0048b4;">{{.C.Button.URL}}</a></p>
{{end}}{{end}}
{{if .C.Notes}}<div style="margin-top:24px;padding-top:18px;border-top:1px solid #edf1f6;">
{{range .C.Notes}}<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#6b7280;">{{.}}</p>
{{end}}</div>{{end}}
</td></tr>
<tr><td align="center" style="padding:22px 12px 8px;font-size:12px;line-height:1.7;color:#8b95a7;">
{{if .C.Footer}}<p style="margin:0 0 8px;">{{range $i, $l := .C.Footer}}{{if $i}} &nbsp;·&nbsp; {{end}}<a href="{{$l.URL}}" style="color:#5b6577;text-decoration:underline;">{{$l.Label}}</a>{{end}}</p>
{{end}}<p style="margin:0;">{{.Brand}} · {{.Tagline}}<br>{{.NoReply}}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`))
