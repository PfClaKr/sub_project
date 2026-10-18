// Package sitehandler stores what admins edit on the site without a
// deploy: text overrides per language (keys of the frontend's
// messages/*.json) and the settings (notice banner, home sections, hero
// image, theme colours). Every change is logged and can be reverted.
//
// The site reads GET /site?locale= (public, cached briefly); admins use
// /admin/site*.
package sitehandler

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"apiserver/uploadhandler"

	"local.com/dynamo"
	"local.com/i18n"
	"local.com/jsonresponse"
	"local.com/jwt"
	"local.com/mailer"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/gorilla/mux"
)

var svc dynamodbiface.DynamoDBAPI = dynamo.New()

const (
	settingsId = "settings"
	logFeed    = "all"
	logPage    = 50
	maxText    = 5000
	maxNotice  = 300
)

// Sections of the home below the hero, in their default order.
var HomeSections = []string{"purposes", "checklist", "feed", "recent", "trust"}

// ThemeTokens are the colours admins may change (frontend
// theme/colorPalette.ts); semantic ones (danger, warning) stay fixed.
var ThemeTokens = []string{"primary", "primaryHover", "primarySoft", "accent", "heading", "text", "muted", "surface", "border", "sky", "pink"}

type Notice struct {
	Enabled bool              `json:"Enabled"`
	Tone    string            `json:"Tone"` // info | warning
	Link    string            `json:"Link"`
	Text    map[string]string `json:"Text"` // per language
	// Version changes whenever the text changes, so visitors who closed
	// the previous notice see the new one.
	Version int64 `json:"Version"`
}

type Section struct {
	Id      string `json:"Id"`
	Enabled bool   `json:"Enabled"`
}

type Settings struct {
	Notice Notice            `json:"Notice"`
	Home   []Section         `json:"Home"`
	Hero   string            `json:"Hero"` // image URL replacing the mascot, or ""
	Theme  map[string]string `json:"Theme"`
}

// Defaults: everything as built.
func Defaults() Settings {
	home := make([]Section, len(HomeSections))
	for i, id := range HomeSections {
		home[i] = Section{Id: id, Enabled: true}
	}
	return Settings{Notice: Notice{Tone: "info", Text: map[string]string{}}, Home: home, Theme: map[string]string{}}
}

var (
	keyPattern  = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,200}$`)
	hexColor    = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
	errBadKey   = errors.New("문구 키가 올바르지 않아요.")
	errTooLong  = errors.New("문구는 5000자 이하로 입력해주세요.")
	errLanguage = errors.New("알 수 없는 언어예요.")
)

// normalize checks admin input and fills what is missing. Unknown
// sections and tokens are dropped; missing sections are appended.
func normalize(s Settings, previous Settings) (Settings, error) {
	out := Defaults()
	if s.Notice.Tone != "warning" {
		s.Notice.Tone = "info"
	}
	if s.Notice.Link != "" && !strings.HasPrefix(s.Notice.Link, "/") && !strings.HasPrefix(s.Notice.Link, "https://") {
		return out, errors.New("공지 링크는 /로 시작하는 주소나 https 주소여야 해요.")
	}
	text := map[string]string{}
	for lang, v := range s.Notice.Text {
		if !i18n.Valid(lang) {
			return out, errLanguage
		}
		v = strings.TrimSpace(v)
		if utf8.RuneCountInString(v) > maxNotice {
			return out, errors.New("공지는 300자 이하로 입력해주세요.")
		}
		if v != "" {
			text[lang] = v
		}
	}
	if s.Notice.Enabled && text[i18n.Korean] == "" {
		return out, errors.New("공지를 켜려면 한국어 문구가 필요해요.")
	}
	out.Notice = Notice{Enabled: s.Notice.Enabled, Tone: s.Notice.Tone, Link: s.Notice.Link, Text: text, Version: previous.Notice.Version}
	if !sameText(text, previous.Notice.Text) {
		out.Notice.Version = time.Now().UnixMilli()
	}

	seen := map[string]bool{}
	out.Home = out.Home[:0]
	for _, sec := range s.Home {
		if contains(HomeSections, sec.Id) && !seen[sec.Id] {
			seen[sec.Id] = true
			out.Home = append(out.Home, sec)
		}
	}
	for _, id := range HomeSections {
		if !seen[id] {
			out.Home = append(out.Home, Section{Id: id, Enabled: true})
		}
	}

	if s.Hero != "" && !strings.HasPrefix(s.Hero, uploadhandler.PublicBase()) {
		return out, errors.New("업로드한 이미지만 사용할 수 있어요.")
	}
	out.Hero = s.Hero

	for token, color := range s.Theme {
		if !contains(ThemeTokens, token) {
			continue
		}
		if !hexColor.MatchString(color) {
			return out, errors.New("색상은 #0048b4 같은 형식으로 입력해주세요.")
		}
		out.Theme[token] = strings.ToLower(color)
	}
	return out, nil
}

func sameText(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if b[k] != v {
			return false
		}
	}
	return true
}

func contains(list []string, v string) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

// ---- storage ----

func loadSettings() (Settings, string, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableSiteContent),
		Key:       dynamo.Item{"Id": {S: aws.String(settingsId)}},
	})
	if err != nil {
		return Defaults(), "", err
	}
	raw := dynamo.S(out.Item, "Data")
	if raw == "" {
		return Defaults(), "", nil
	}
	var s Settings
	if err := json.Unmarshal([]byte(raw), &s); err != nil {
		return Defaults(), raw, nil
	}
	fixed, _ := normalize(s, s)
	return fixed, raw, nil
}

// saveSettings also makes this process's mails pick up a new theme at
// once (loginserver rereads it within a minute).
func saveSettings(s Settings) (string, error) {
	defer mailer.ForgetTheme()
	b, _ := json.Marshal(s)
	_, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String(dynamo.TableSiteContent),
		Item: dynamo.Item{
			"Id":        {S: aws.String(settingsId)},
			"Data":      {S: aws.String(string(b))},
			"UpdatedAt": {N: aws.String(strconv.FormatInt(time.Now().UnixMilli(), 10))},
		},
	})
	return string(b), err
}

func textsId(lang string) string { return "texts:" + lang }

func loadTexts(lang string) (map[string]string, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableSiteContent),
		Key:       dynamo.Item{"Id": {S: aws.String(textsId(lang))}},
	})
	if err != nil {
		return nil, err
	}
	texts := map[string]string{}
	if m := out.Item["Texts"]; m != nil {
		for k, v := range m.M {
			if v.S != nil {
				texts[k] = *v.S
			}
		}
	}
	return texts, nil
}

// setText stores one override, or removes it when text is "".
func setText(lang, key, text string) error {
	names := map[string]*string{"#k": aws.String(key)}
	if text == "" {
		_, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
			TableName:                aws.String(dynamo.TableSiteContent),
			Key:                      dynamo.Item{"Id": {S: aws.String(textsId(lang))}},
			UpdateExpression:         aws.String("REMOVE Texts.#k"),
			ConditionExpression:      aws.String("attribute_exists(Texts)"),
			ExpressionAttributeNames: names,
		})
		if isConditionFailed(err) {
			return nil
		}
		return err
	}
	// The map has to exist before a key can be set inside it.
	_, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TableSiteContent),
		Key:                       dynamo.Item{"Id": {S: aws.String(textsId(lang))}},
		UpdateExpression:          aws.String("SET Texts = if_not_exists(Texts, :empty)"),
		ExpressionAttributeValues: dynamo.Item{":empty": {M: dynamo.Item{}}},
	})
	if err != nil {
		return err
	}
	_, err = svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TableSiteContent),
		Key:                       dynamo.Item{"Id": {S: aws.String(textsId(lang))}},
		UpdateExpression:          aws.String("SET Texts.#k = :t"),
		ExpressionAttributeNames:  names,
		ExpressionAttributeValues: dynamo.Item{":t": {S: aws.String(text)}},
	})
	return err
}

func isConditionFailed(err error) bool {
	var ae interface{ Code() string }
	return errors.As(err, &ae) && ae.Code() == dynamodb.ErrCodeConditionalCheckFailedException
}

// LogEntry is one change: Target is "text:<lang>:<key>" or "settings".
type LogEntry struct {
	At      int64  `json:"At"`
	Target  string `json:"Target"`
	Old     string `json:"Old"`
	New     string `json:"New"`
	AdminId string `json:"AdminId"`
	Admin   string `json:"Admin"`
}

func logChange(target, old, new, adminId string) error {
	nickname := ""
	if out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName:            aws.String(dynamo.TableUsers),
		Key:                  dynamo.Item{"UserId": {S: aws.String(adminId)}},
		ProjectionExpression: aws.String("UserNickname"),
	}); err == nil {
		nickname = dynamo.S(out.Item, "UserNickname")
	}
	_, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String(dynamo.TableSiteContentLog),
		Item: dynamo.Item{
			"Feed":    {S: aws.String(logFeed)},
			"At":      {N: aws.String(strconv.FormatInt(time.Now().UnixMilli(), 10))},
			"Target":  {S: aws.String(target)},
			"Old":     {S: aws.String(old)},
			"New":     {S: aws.String(new)},
			"AdminId": {S: aws.String(adminId)},
			"Admin":   {S: aws.String(nickname)},
		},
	})
	return err
}

func recentLog() ([]LogEntry, error) {
	out, err := svc.Query(&dynamodb.QueryInput{
		TableName:                 aws.String(dynamo.TableSiteContentLog),
		KeyConditionExpression:    aws.String("Feed = :f"),
		ExpressionAttributeValues: dynamo.Item{":f": {S: aws.String(logFeed)}},
		ScanIndexForward:          aws.Bool(false),
		Limit:                     aws.Int64(logPage),
	})
	if err != nil {
		return nil, err
	}
	entries := make([]LogEntry, 0, len(out.Items))
	for _, it := range out.Items {
		var at int64
		if v := it["At"]; v != nil && v.N != nil {
			at, _ = strconv.ParseInt(*v.N, 10, 64)
		}
		entries = append(entries, LogEntry{
			At: at, Target: dynamo.S(it, "Target"), Old: dynamo.S(it, "Old"), New: dynamo.S(it, "New"),
			AdminId: dynamo.S(it, "AdminId"), Admin: dynamo.S(it, "Admin"),
		})
	}
	return entries, nil
}

// ---- handlers ----

// Register adds GET /site and the admin routes (guarded by requireAdmin).
func Register(r *mux.Router, requireAdmin func(http.Handler) http.Handler) {
	r.HandleFunc("/site", publicHandler).Methods("GET")
	a := r.PathPrefix("/admin/site").Subrouter()
	a.Use(func(next http.Handler) http.Handler { return requireAdmin(next) })
	a.HandleFunc("", adminGetHandler).Methods("GET")
	a.HandleFunc("/text", setTextHandler).Methods("PUT")
	a.HandleFunc("/settings", setSettingsHandler).Methods("PUT")
	a.HandleFunc("/revert", revertHandler).Methods("POST")
	a.HandleFunc("/preview", getPreviewHandler).Methods("GET")
	a.HandleFunc("/preview", putPreviewHandler).Methods("PUT")
	a.HandleFunc("/preview", deletePreviewHandler).Methods("DELETE")
	a.HandleFunc("/preview/mail", previewMailHandler).Methods("POST")
}

// publicHandler: GET /site?locale=fr → the overrides of that language
// and the settings, for every page render (the site caches it 30 s).
func publicHandler(w http.ResponseWriter, r *http.Request) {
	lang := r.URL.Query().Get("locale")
	if !i18n.Valid(lang) {
		lang = i18n.Korean
	}
	texts, err := loadTexts(lang)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	settings, _, err := loadSettings()
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=30")
	jsonresponse.New(w, http.StatusOK, map[string]interface{}{"Texts": texts, "Settings": settings})
}

func adminGetHandler(w http.ResponseWriter, r *http.Request) {
	texts := map[string]map[string]string{}
	for _, lang := range []string{i18n.Korean, i18n.French, i18n.English} {
		t, err := loadTexts(lang)
		if err != nil {
			jsonresponse.Internal(w, err)
			return
		}
		texts[lang] = t
	}
	settings, _, err := loadSettings()
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	entries, err := recentLog()
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]interface{}{
		"Texts": texts, "Settings": settings, "Log": entries, "Sections": HomeSections, "ThemeTokens": ThemeTokens, "MailTypes": MailTypes,
	})
}

// applyText validates, stores and logs one text override.
func applyText(lang, key, text, adminId string) error {
	if !i18n.Valid(lang) {
		return errLanguage
	}
	if !keyPattern.MatchString(key) {
		return errBadKey
	}
	text = strings.TrimRight(text, " \n")
	if utf8.RuneCountInString(text) > maxText {
		return errTooLong
	}
	current, err := loadTexts(lang)
	if err != nil {
		return err
	}
	old := current[key]
	if old == text {
		return nil
	}
	if err := setText(lang, key, text); err != nil {
		return err
	}
	return logChange("text:"+lang+":"+key, old, text, adminId)
}

// setTextHandler: PUT /admin/site/text {Locale, Key, Text}; an empty
// Text goes back to the built-in wording.
func setTextHandler(w http.ResponseWriter, r *http.Request) {
	var body struct{ Locale, Key, Text string }
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&body); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	if err := applyText(body.Locale, body.Key, body.Text, jwt.UserID(r.Context())); err != nil {
		if errors.Is(err, errLanguage) || errors.Is(err, errBadKey) || errors.Is(err, errTooLong) {
			jsonresponse.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"ok": true})
}

func setSettingsHandler(w http.ResponseWriter, r *http.Request) {
	var s Settings
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 64<<10)).Decode(&s); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	previous, oldRaw, err := loadSettings()
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	next, err := normalize(s, previous)
	if err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	newRaw, err := saveSettings(next)
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if err := logChange(settingsId, oldRaw, newRaw, jwt.UserID(r.Context())); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, next)
}

// revertHandler: POST /admin/site/revert {At} puts back the value a
// logged change replaced (itself logged, so it can be undone too).
func revertHandler(w http.ResponseWriter, r *http.Request) {
	var body struct{ At int64 }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.At == 0 {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableSiteContentLog),
		Key:       dynamo.Item{"Feed": {S: aws.String(logFeed)}, "At": {N: aws.String(strconv.FormatInt(body.At, 10))}},
	})
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if out.Item == nil {
		jsonresponse.Error(w, http.StatusNotFound, "변경 기록을 찾을 수 없어요.")
		return
	}
	adminId := jwt.UserID(r.Context())
	target, old := dynamo.S(out.Item, "Target"), dynamo.S(out.Item, "Old")
	if rest, ok := strings.CutPrefix(target, "text:"); ok {
		lang, key, _ := strings.Cut(rest, ":")
		if err := applyText(lang, key, old, adminId); err != nil {
			jsonresponse.Internal(w, err)
			return
		}
		jsonresponse.New(w, http.StatusOK, map[string]bool{"ok": true})
		return
	}
	previous, oldRaw, err := loadSettings()
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	restored := Defaults()
	if old != "" {
		var s Settings
		if err := json.Unmarshal([]byte(old), &s); err == nil {
			restored, _ = normalize(s, previous)
		}
	}
	newRaw, err := saveSettings(restored)
	if err == nil {
		err = logChange(settingsId, oldRaw, newRaw, adminId)
	}
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"ok": true})
}
