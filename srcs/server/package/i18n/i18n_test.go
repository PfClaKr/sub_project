package i18n

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
)

func TestPick(t *testing.T) {
	cases := []struct{ cookie, accept, want string }{
		{"fr", "ko-KR", "fr"},
		{"", "fr-FR,fr;q=0.9,ko;q=0.8", "ko"},
		{"", "fr-FR,fr;q=0.9,en;q=0.8", "fr"},
		{"", "de,en;q=0.5,fr;q=0.4", "en"},
		{"", "de,ja", "ko"},
		{"xx", "", "ko"},
		{"", "fr;q=0", "ko"},
	}
	for _, c := range cases {
		if got := Pick(c.cookie, c.accept); got != c.want {
			t.Errorf("Pick(%q, %q) = %q, want %q", c.cookie, c.accept, got, c.want)
		}
	}
}

func TestTranslate(t *testing.T) {
	if got := Translate(French, "로그인이 필요해요."); got != "Vous devez être connecté." {
		t.Errorf("exact = %q", got)
	}
	if got := Translate(English, "[잇냥] 새 알림 3개"); got != "[Itnyang] 3 new notifications" {
		t.Errorf("template = %q", got)
	}
	if got := Translate(Korean, "로그인이 필요해요."); got != "로그인이 필요해요." {
		t.Errorf("korean = %q", got)
	}
	if got := Translate(French, "모르는 문장이에요."); got != "모르는 문장이에요." {
		t.Errorf("unknown = %q", got)
	}
	if got := T(English, "%s님, 잇냥에서 알려드려요.\n\n", "Mina"); got != "Hi Mina, here's what's new on Itnyang.\n\n" {
		t.Errorf("T = %q", got)
	}
}

func TestMiddleware(t *testing.T) {
	var lang, ctxLang string
	h := Middleware(httpHandlerFunc(func(w httpResponseWriter, r *httpRequest) {
		lang = WriterLang(w)
		ctxLang = LangOf(r.Context())
	}))
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Accept-Language", "en-GB,en;q=0.9")
	h.ServeHTTP(httptest.NewRecorder(), req)
	if lang != "en" || ctxLang != "en" {
		t.Errorf("lang = %q, ctx = %q", lang, ctxLang)
	}
}

// sentence matches a Korean string literal that reads as a message: it
// ends with a sentence mark (or a newline, for mail templates).
var sentence = regexp.MustCompile(`"((?:[^"\\]|\\.)*[가-힣](?:[^"\\]|\\.)*(?:[.?!]|\\n))"`)

// Every Korean sentence the services can send must have a translation.
func TestCatalogCoversTheServices(t *testing.T) {
	root := filepath.Join("..", "..")
	for _, dir := range []string{"apiserver", "loginserver", "chatserver", "package"} {
		filepath.WalkDir(filepath.Join(root, dir), func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() || !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
				return nil
			}
			// Search vocabulary and seed data are not messages.
			if strings.Contains(path, "eshandler") || regexp.MustCompile(`dummy|demo|mock`).MatchString(path) || strings.Contains(path, "i18n") {
				return nil
			}
			src, _ := os.ReadFile(path)
			for i, line := range strings.Split(string(src), "\n") {
				if strings.HasPrefix(strings.TrimSpace(line), "//") {
					continue
				}
				for _, m := range sentence.FindAllStringSubmatch(line, -1) {
					text, err := strconv.Unquote(`"` + m[1] + `"`)
					if err != nil {
						continue
					}
					if _, ok := catalog[text]; !ok {
						t.Errorf("%s:%d: no translation for %q", path, i+1, text)
					}
				}
			}
			return nil
		})
	}
}

type (
	httpResponseWriter = http.ResponseWriter
	httpRequest        = http.Request
	httpHandlerFunc    = http.HandlerFunc
)
