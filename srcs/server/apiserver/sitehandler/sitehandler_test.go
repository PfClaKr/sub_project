package sitehandler

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNormalizeKeepsOnlyKnownValues(t *testing.T) {
	in := Settings{
		Notice: Notice{Enabled: true, Tone: "loud", Text: map[string]string{"ko": " 점검 안내 ", "fr": ""}},
		Home:   []Section{{Id: "recent", Enabled: false}, {Id: "nope", Enabled: true}, {Id: "recent", Enabled: true}},
		Theme:  map[string]string{"primary": "#AA0000", "danger": "#000000"},
	}
	out, err := normalize(in, Defaults())
	if err != nil {
		t.Fatal(err)
	}
	if out.Notice.Tone != "info" || out.Notice.Text["ko"] != "점검 안내" || len(out.Notice.Text) != 1 || out.Notice.Version == 0 {
		t.Errorf("notice = %+v", out.Notice)
	}
	if len(out.Home) != len(HomeSections) || out.Home[0].Id != "recent" || out.Home[0].Enabled {
		t.Errorf("home = %+v", out.Home)
	}
	if out.Theme["primary"] != "#aa0000" || out.Theme["danger"] != "" {
		t.Errorf("theme = %+v", out.Theme)
	}
}

func TestNormalizeRefuses(t *testing.T) {
	cases := map[string]Settings{
		"notice without Korean": {Notice: Notice{Enabled: true, Text: map[string]string{"fr": "x"}}},
		"bad link":              {Notice: Notice{Link: "javascript:alert(1)"}},
		"bad colour":            {Theme: map[string]string{"primary": "red"}},
		"foreign image":         {Hero: "https://evil.example/cat.png"},
		"long notice":           {Notice: Notice{Text: map[string]string{"ko": strings.Repeat("가", 301)}}},
	}
	for name, s := range cases {
		if _, err := normalize(s, Defaults()); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestNoticeVersionMovesOnlyWithTheText(t *testing.T) {
	prev := Defaults()
	prev.Notice = Notice{Text: map[string]string{"ko": "안내"}, Version: 42}
	same, _ := normalize(Settings{Notice: Notice{Enabled: true, Text: map[string]string{"ko": "안내"}}}, prev)
	if same.Notice.Version != 42 {
		t.Errorf("unchanged text bumped the version: %d", same.Notice.Version)
	}
	changed, _ := normalize(Settings{Notice: Notice{Text: map[string]string{"ko": "새 안내"}}}, prev)
	if changed.Notice.Version == 42 {
		t.Error("new text kept the version")
	}
}

func TestTextKeys(t *testing.T) {
	for _, k := range []string{"home.hero.lead", "enums.region.x"} {
		if !keyPattern.MatchString(k) {
			t.Errorf("%q refused", k)
		}
	}
	if keyPattern.MatchString("home hero") || keyPattern.MatchString("") {
		t.Error("bad key accepted")
	}
}

func TestCheckDraft(t *testing.T) {
	d, err := checkDraft(Draft{
		Settings: &Settings{Theme: map[string]string{"primary": "#AA3300"}},
		Texts:    map[string]map[string]string{"fr": {"home.hero.lead": "Bonjour \n"}},
	}, Defaults())
	if err != nil {
		t.Fatal(err)
	}
	if d.Settings.Theme["primary"] != "#aa3300" || len(d.Settings.Home) != len(HomeSections) || d.Texts["fr"]["home.hero.lead"] != "Bonjour" {
		t.Errorf("draft = %+v / %+v", d.Settings, d.Texts)
	}
	for name, bad := range map[string]Draft{
		"bad colour":   {Settings: &Settings{Theme: map[string]string{"primary": "red"}}},
		"bad language": {Texts: map[string]map[string]string{"de": {"a": "b"}}},
		"bad key":      {Texts: map[string]map[string]string{"ko": {"a b": "c"}}},
		"long text":    {Texts: map[string]map[string]string{"ko": {"a": strings.Repeat("가", maxText+1)}}},
	} {
		if _, err := checkDraft(bad, Defaults()); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestMergeTexts(t *testing.T) {
	got := mergeTexts(map[string]string{"a": "saved", "b": "saved"}, map[string]string{"b": "", "c": "draft"})
	if len(got) != 2 || got["a"] != "saved" || got["c"] != "draft" {
		t.Errorf("merged = %v (an empty draft text goes back to the built-in one)", got)
	}
}

func TestPreviewMail(t *testing.T) {
	for _, typ := range MailTypes {
		rr := httptest.NewRecorder()
		body := `{"Type":"` + typ + `","Locale":"fr","Theme":{"primary":"#aa3300","danger":"#000000"}}`
		previewMailHandler(rr, httptest.NewRequest("POST", "/admin/site/preview/mail", strings.NewReader(body)))
		var out struct{ Subject, From, HTML string }
		json.Unmarshal(rr.Body.Bytes(), &out)
		if rr.Code != 200 || !strings.HasPrefix(out.Subject, "[Itnyang]") || out.From != "Itnyang" {
			t.Fatalf("%s: %d %+v", typ, rr.Code, out)
		}
		if !strings.Contains(out.HTML, "#aa3300") || strings.Contains(out.HTML, "#0048b4") || !strings.Contains(out.HTML, `lang="fr"`) {
			t.Errorf("%s: the draft colour or the language is missing", typ)
		}
	}
	rr := httptest.NewRecorder()
	previewMailHandler(rr, httptest.NewRequest("POST", "/admin/site/preview/mail", strings.NewReader(`{"Type":"nope"}`)))
	if rr.Code != 400 {
		t.Errorf("unknown type = %d, want 400", rr.Code)
	}
}
