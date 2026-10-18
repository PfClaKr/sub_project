package mailer

import (
	"encoding/json"
	"log"
	"regexp"
	"strings"
	"sync"
	"time"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

// Theme holds the mail colours. They come from the site's theme tokens
// (apiserver sitehandler ThemeTokens, frontend theme/colorPalette.ts), so
// a colour changed on /admin/site reaches the mails too.
type Theme struct {
	Primary string // button, links, brand, item marker
	Heading string
	Text    string
	Muted   string // small print, footer
	Surface string // page and item background
	Border  string
}

// DefaultTheme is the site's built-in palette (frontend
// theme/colorPalette.ts; libs/contract.test.ts compares them).
var DefaultTheme = Theme{
	Primary: "#0048b4",
	Heading: "#101750",
	Text:    "#1f2433",
	Muted:   "#5d6382",
	Surface: "#f6f7fb",
	Border:  "#dfe3f0",
}

var hexColor = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// ThemeFrom lays site tokens (the settings' Theme map, e.g.
// {"primary": "#aa3300"}) over the defaults. Anything that is not a
// #rrggbb colour is ignored.
func ThemeFrom(tokens map[string]string) Theme {
	t := DefaultTheme
	for token, field := range map[string]*string{
		"primary": &t.Primary, "heading": &t.Heading, "text": &t.Text,
		"muted": &t.Muted, "surface": &t.Surface, "border": &t.Border,
	} {
		if v := tokens[token]; hexColor.MatchString(v) {
			*field = strings.ToLower(v)
		}
	}
	return t
}

// themeSource returns the site's theme tokens; nil (tests, tools) means
// the built-in colours. Services turn it on with UseSiteTheme.
var themeSource func() (map[string]string, error)

// UseSiteTheme makes mails follow the theme saved on /admin/site (the
// "settings" row of SiteContent), read at most once a minute.
func UseSiteTheme() {
	db := dynamo.New()
	themeSource = func() (map[string]string, error) {
		out, err := db.GetItem(&dynamodb.GetItemInput{
			TableName: aws.String(dynamo.TableSiteContent),
			Key:       dynamo.Item{"Id": {S: aws.String("settings")}},
		})
		if err != nil {
			return nil, err
		}
		var s struct{ Theme map[string]string }
		if raw := dynamo.S(out.Item, "Data"); raw != "" {
			if err := json.Unmarshal([]byte(raw), &s); err != nil {
				return nil, err
			}
		}
		return s.Theme, nil
	}
}

const themeTTL = time.Minute

var theme struct {
	sync.Mutex
	value Theme
	at    time.Time
}

// CurrentTheme is the theme mails are sent with. On a read error it keeps
// the last known colours (the defaults at first) and retries a minute
// later.
func CurrentTheme() Theme {
	if themeSource == nil {
		return DefaultTheme
	}
	theme.Lock()
	defer theme.Unlock()
	if !theme.at.IsZero() && time.Since(theme.at) < themeTTL {
		return theme.value
	}
	tokens, err := themeSource()
	if err != nil {
		log.Printf("mail theme: %v", err)
		if theme.at.IsZero() {
			theme.value = DefaultTheme
		}
	} else {
		theme.value = ThemeFrom(tokens)
	}
	theme.at = time.Now()
	return theme.value
}

// ForgetTheme drops the cached theme, so the next mail reads it again
// (called when an admin saves the settings in this process).
func ForgetTheme() {
	theme.Lock()
	theme.at = time.Time{}
	theme.Unlock()
}
