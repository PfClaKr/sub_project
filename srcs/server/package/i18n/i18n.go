// Package i18n picks the language of a request and translates the
// server's user-facing Korean messages into French or English. Korean is
// the source: code keeps writing Korean text, and the catalog maps each
// message (or Sprintf template) to its translations, applied where a
// response leaves the server (jsonresponse, the GraphQL handler) and
// when mails and pushes are written for a member's saved language.
package i18n

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const (
	Korean  = "ko"
	French  = "fr"
	English = "en"
)

// Cookie is set by the site's language menu (frontend i18n/config.ts).
const Cookie = "itnyang.locale"

// Valid reports whether lang is a supported language.
func Valid(lang string) bool {
	return lang == Korean || lang == French || lang == English
}

// Pick chooses from the cookie, else from Accept-Language with the same
// rule as the site: any Korean wins (most members are Koreans whose
// phones are set to French), then the first supported language.
func Pick(cookie, acceptLanguage string) string {
	if Valid(cookie) {
		return cookie
	}
	type pref struct {
		lang string
		q    float64
	}
	var prefs []pref
	for _, part := range strings.Split(acceptLanguage, ",") {
		fields := strings.Split(strings.TrimSpace(part), ";")
		lang := strings.ToLower(strings.SplitN(fields[0], "-", 2)[0])
		q := 1.0
		for _, f := range fields[1:] {
			if v, ok := strings.CutPrefix(strings.TrimSpace(f), "q="); ok {
				q, _ = strconv.ParseFloat(v, 64)
			}
		}
		if lang != "" && q > 0 {
			prefs = append(prefs, pref{lang, q})
		}
	}
	best, bestQ := "", -1.0
	for _, p := range prefs {
		if p.lang == Korean {
			return Korean
		}
		if Valid(p.lang) && p.q > bestQ {
			best, bestQ = p.lang, p.q
		}
	}
	if best != "" {
		return best
	}
	return Korean
}

// FromRequest is Pick for an HTTP request.
func FromRequest(r *http.Request) string {
	cookie := ""
	if c, err := r.Cookie(Cookie); err == nil {
		cookie = c.Value
	}
	return Pick(cookie, r.Header.Get("Accept-Language"))
}

type ctxKey struct{}

// WithLang stores the language in a context (GraphQL resolvers read it).
func WithLang(ctx context.Context, lang string) context.Context {
	return context.WithValue(ctx, ctxKey{}, lang)
}

// LangOf returns the context's language, Korean by default.
func LangOf(ctx context.Context) string {
	if lang, ok := ctx.Value(ctxKey{}).(string); ok && Valid(lang) {
		return lang
	}
	return Korean
}

// Writer is implemented by the ResponseWriter that Middleware passes on,
// so jsonresponse can translate without a request.
type Writer interface {
	http.ResponseWriter
	Lang() string
}

type langWriter struct {
	http.ResponseWriter
	lang string
}

func (w *langWriter) Lang() string { return w.lang }

// Hijack keeps websockets (chatserver) working behind the middleware.
func (w *langWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("i18n: response writer cannot hijack")
	}
	return h.Hijack()
}

func (w *langWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Middleware puts the request's language in its context and its writer.
func Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lang := FromRequest(r)
		next.ServeHTTP(&langWriter{ResponseWriter: w, lang: lang}, r.WithContext(WithLang(r.Context(), lang)))
	})
}

// WriterLang returns the language Middleware attached to w, if any.
func WriterLang(w http.ResponseWriter) string {
	if lw, ok := w.(Writer); ok {
		return lw.Lang()
	}
	return Korean
}

// T translates a Korean message or Sprintf template and formats it:
// T(lang, "새 알림 %d개", 3). Unknown text, and any language other than
// French or English (an unset Users.Locale), stay Korean.
func T(lang, korean string, args ...interface{}) string {
	text := korean
	if tr, ok := catalog[korean]; ok {
		switch lang {
		case French:
			text = tr[0]
		case English:
			text = tr[1]
		}
	}
	if len(args) > 0 {
		return fmt.Sprintf(text, args...)
	}
	return text
}

// verb matches the Sprintf verbs used in catalog templates.
var verb = regexp.MustCompile(`%[sd]`)

type pattern struct {
	re       *regexp.Regexp
	template string
}

var patterns = func() []pattern {
	var out []pattern
	for ko := range catalog {
		if !verb.MatchString(ko) {
			continue
		}
		parts := verb.Split(ko, -1)
		for i, p := range parts {
			parts[i] = regexp.QuoteMeta(p)
		}
		out = append(out, pattern{regexp.MustCompile("^" + strings.Join(parts, "(.+?)") + "$"), ko})
	}
	// The most specific template wins: "[잇냥] 새 알림 %d개" before "[잇냥] %s".
	sort.Slice(out, func(i, j int) bool {
		return len(verb.ReplaceAllString(out[i].template, "")) > len(verb.ReplaceAllString(out[j].template, ""))
	})
	return out
}()

// Translate is T for text that was already formatted in Korean (an error
// message on its way out): exact messages first, then templates whose
// filled-in values are carried over.
func Translate(lang, message string) string {
	if (lang != French && lang != English) || message == "" {
		return message
	}
	if _, ok := catalog[message]; ok {
		return T(lang, message)
	}
	for _, p := range patterns {
		m := p.re.FindStringSubmatch(message)
		if m == nil {
			continue
		}
		args := make([]interface{}, len(m)-1)
		for i, v := range m[1:] {
			args[i] = v
		}
		target := T(lang, p.template)
		return fmt.Sprintf(verb.ReplaceAllString(target, "%s"), args...)
	}
	return message
}
