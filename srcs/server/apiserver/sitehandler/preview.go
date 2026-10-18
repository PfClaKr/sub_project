package sitehandler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"local.com/dynamo"
	"local.com/i18n"
	"local.com/jsonresponse"
	"local.com/jwt"
	"local.com/mailer"
	"local.com/notify"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

// Preview: an admin's unsaved changes, kept per admin in SiteContent
// ("preview:<userId>"). While the editor's preview is open, the site
// renders that admin's pages from GET /admin/site/preview instead of
// GET /site (frontend libs/site.server.ts, cookie itnyang.preview), so
// nobody else sees the draft.

const (
	previewPrefix = "preview:"
	previewTTL    = 24 * time.Hour // older drafts are ignored
	maxDraftTexts = 200
)

// Draft: Settings replaces the saved settings when set; Texts are
// overrides per language laid over the saved ones ("" = built-in text).
type Draft struct {
	Settings *Settings                    `json:"Settings"`
	Texts    map[string]map[string]string `json:"Texts"`
}

func previewId(userId string) string { return previewPrefix + userId }

// checkDraft validates a draft like a save would and normalizes it.
func checkDraft(d Draft, saved Settings) (Draft, error) {
	out := Draft{Texts: map[string]map[string]string{}}
	if d.Settings != nil {
		s, err := normalize(*d.Settings, saved)
		if err != nil {
			return out, err
		}
		out.Settings = &s
	}
	count := 0
	for lang, texts := range d.Texts {
		if !i18n.Valid(lang) {
			return out, errLanguage
		}
		out.Texts[lang] = map[string]string{}
		for key, text := range texts {
			if !keyPattern.MatchString(key) {
				return out, errBadKey
			}
			if count++; count > maxDraftTexts {
				return out, errors.New("미리보기 문구가 너무 많아요.")
			}
			text = strings.TrimRight(text, " \n")
			if utf8.RuneCountInString(text) > maxText {
				return out, errTooLong
			}
			out.Texts[lang][key] = text
		}
	}
	return out, nil
}

func loadDraft(userId string) (Draft, bool, error) {
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableSiteContent),
		Key:       dynamo.Item{"Id": {S: aws.String(previewId(userId))}},
	})
	if err != nil || out.Item == nil {
		return Draft{}, false, err
	}
	var at int64
	if v := out.Item["UpdatedAt"]; v != nil && v.N != nil {
		at, _ = strconv.ParseInt(*v.N, 10, 64)
	}
	if time.Since(time.UnixMilli(at)) > previewTTL {
		return Draft{}, false, nil
	}
	var d Draft
	if err := json.Unmarshal([]byte(dynamo.S(out.Item, "Data")), &d); err != nil {
		return Draft{}, false, nil
	}
	return d, true, nil
}

// putPreviewHandler: PUT /admin/site/preview {Settings?, Texts?} stores
// the draft (validated, so mistakes show before saving).
func putPreviewHandler(w http.ResponseWriter, r *http.Request) {
	var d Draft
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 256<<10)).Decode(&d); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	saved, _, err := loadSettings()
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	d, err = checkDraft(d, saved)
	if err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, err.Error())
		return
	}
	b, _ := json.Marshal(d)
	if _, err := svc.PutItem(&dynamodb.PutItemInput{
		TableName: aws.String(dynamo.TableSiteContent),
		Item: dynamo.Item{
			"Id":        {S: aws.String(previewId(jwt.UserID(r.Context())))},
			"Data":      {S: aws.String(string(b))},
			"UpdatedAt": {N: aws.String(strconv.FormatInt(time.Now().UnixMilli(), 10))},
		},
	}); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"ok": true})
}

// getPreviewHandler: GET /admin/site/preview?locale= answers like
// GET /site, with the caller's draft laid over the saved content.
func getPreviewHandler(w http.ResponseWriter, r *http.Request) {
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
	draft, ok, err := loadDraft(jwt.UserID(r.Context()))
	if err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	if ok {
		texts = mergeTexts(texts, draft.Texts[lang])
		if draft.Settings != nil {
			settings = *draft.Settings
		}
	}
	w.Header().Set("Cache-Control", "no-store")
	jsonresponse.New(w, http.StatusOK, map[string]interface{}{"Texts": texts, "Settings": settings, "Preview": ok})
}

// mergeTexts lays draft overrides over saved ones; an empty draft text
// means the built-in wording.
func mergeTexts(saved, draft map[string]string) map[string]string {
	out := map[string]string{}
	for k, v := range saved {
		out[k] = v
	}
	for k, v := range draft {
		if v == "" {
			delete(out, k)
		} else {
			out[k] = v
		}
	}
	return out
}

// deletePreviewHandler: DELETE /admin/site/preview ends the preview.
func deletePreviewHandler(w http.ResponseWriter, r *http.Request) {
	if _, err := svc.DeleteItem(&dynamodb.DeleteItemInput{
		TableName: aws.String(dynamo.TableSiteContent),
		Key:       dynamo.Item{"Id": {S: aws.String(previewId(jwt.UserID(r.Context())))}},
	}); err != nil {
		jsonresponse.Internal(w, err)
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]bool{"ok": true})
}

// MailTypes are the mails the preview can show.
var MailTypes = []string{"verify", "reset", "digest"}

// previewMailHandler: POST /admin/site/preview/mail {Type, Locale, Theme}
// renders a sample of a real mail with the given (unsaved) theme
// colours: {Subject, From, HTML}.
func previewMailHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Type, Locale string
		Theme        map[string]string
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10)).Decode(&body); err != nil {
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	lang := body.Locale
	if !i18n.Valid(lang) {
		lang = i18n.Korean
	}
	var subject string
	var content mailer.Content
	switch body.Type {
	case "verify":
		subject, content = mailer.Verification(lang, mailer.AppURL()+"/account/verify?token=preview")
	case "reset":
		subject, content = mailer.PasswordReset(lang, mailer.AppURL()+"/account/reset?token=preview")
	case "digest":
		subject, content = notify.SampleMail(lang)
	default:
		jsonresponse.Error(w, http.StatusBadRequest, "잘못된 요청이에요.")
		return
	}
	jsonresponse.New(w, http.StatusOK, map[string]string{
		"Subject": subject,
		"From":    i18n.T(lang, "잇냥"),
		"HTML":    content.HTMLWith(mailer.ThemeFrom(body.Theme)),
	})
}
