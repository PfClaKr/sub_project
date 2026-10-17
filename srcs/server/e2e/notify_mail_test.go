//go:build e2e

package e2e

import (
	"mime"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

type mail struct {
	Subject, Body, Unsubscribe string
}

// mails returns the messages MailHog holds for an address, subjects
// decoded.
func mails(t *testing.T, email string) []mail {
	t.Helper()
	var found struct {
		Items []struct {
			Content struct {
				Headers map[string][]string
				Body    string
			}
		}
	}
	do(t, newClient(), "GET", mailhog+"/api/v2/search?kind=to&query="+q(email), nil, &found)
	dec := new(mime.WordDecoder)
	out := []mail{}
	for _, m := range found.Items {
		h := m.Content.Headers
		subject := strings.Join(h["Subject"], "")
		if d, err := dec.DecodeHeader(subject); err == nil {
			subject = d
		}
		out = append(out, mail{Subject: subject, Body: strings.ReplaceAll(m.Content.Body, "=\r\n", ""), Unsubscribe: strings.Join(h["List-Unsubscribe"], "")})
	}
	return out
}

// waitMail polls MailHog until a mail with the subject arrives. The dev
// stack runs the mail worker every 2s with an 8s digest delay.
func waitMail(t *testing.T, email, subject string, within time.Duration) mail {
	t.Helper()
	deadline := time.Now().Add(within)
	for time.Now().Before(deadline) {
		for _, m := range mails(t, email) {
			if m.Subject == subject {
				return m
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	t.Fatalf("no %q mail for %s within %s", subject, email, within)
	return mail{}
}

func TestNotificationMails(t *testing.T) {
	author := signup(t, "mail-author")
	alice := signup(t, "mail-alice")
	bob := signup(t, "mail-bob")
	p := newPost(t, author, "free", "일상", "e2e 메일 알림 "+runID, false)

	// Two comments within the digest delay arrive as one mail.
	addComment(t, alice, p.PostId, "첫 번째 댓글 "+runID, "", false)
	addComment(t, alice, p.PostId, "두 번째 댓글 "+runID, "", false)
	digest := waitMail(t, author.Email, "[잇냥] 새 알림 2개", 30*time.Second)
	if !strings.Contains(digest.Body, "첫 번째 댓글 "+runID) || !strings.Contains(digest.Body, "두 번째 댓글 "+runID) {
		t.Errorf("digest body = %q", digest.Body)
	}
	if !strings.Contains(digest.Body, "/community/"+p.PostId) || !strings.Contains(digest.Body, "/notifications/unsubscribe?u=") {
		t.Errorf("digest lacks the post link or the unsubscribe link: %q", digest.Body)
	}

	// Accepted answers are mailed right away.
	qna := newPost(t, author, "qna", "기타", "e2e 메일 채택 "+runID, false)
	answer := addComment(t, alice, qna.PostId, "답변입니다", "", false)
	gql(t, author.c, `mutation($p: String!, $c: String!) { acceptAnswer(PostId: $p, CommentId: $c) { Solved } }`, map[string]interface{}{"p": qna.PostId, "c": answer.CommentId})
	waitMail(t, alice.Email, "[잇냥] 내 답변이 채택됐어요", 15*time.Second)

	// Read on the site before the digest goes out: no mail.
	time.Sleep(10 * time.Second) // let the author's pending answer notification go out first
	before := len(mails(t, author.Email))
	addComment(t, bob, p.PostId, "읽고 나면 메일 없음 "+runID, "", false)
	gql(t, author.c, `mutation { markNotificationsRead }`, nil)
	time.Sleep(14 * time.Second)
	for _, m := range mails(t, author.Email)[:len(mails(t, author.Email))-before] {
		if strings.Contains(m.Body, "읽고 나면 메일 없음 "+runID) {
			t.Error("a notification read on the site was still mailed")
		}
	}

	// One-click unsubscribe from the List-Unsubscribe header.
	link := strings.Trim(digest.Unsubscribe, "<>")
	u, err := url.Parse(link)
	if err != nil || link == "" {
		t.Fatalf("List-Unsubscribe = %q", digest.Unsubscribe)
	}
	if code := do(t, newClient(), "POST", apiURL+"/notifications/unsubscribe?"+u.RawQuery+"x", nil, nil); code != http.StatusBadRequest {
		t.Errorf("tampered unsubscribe = %d, want 400", code)
	}
	if code := do(t, newClient(), "POST", apiURL+"/notifications/unsubscribe?"+u.RawQuery, nil, nil); code != http.StatusOK {
		t.Fatalf("unsubscribe = %d", code)
	}
	var settings struct {
		EmailEnabled, HasEmail bool
		Items                  []struct {
			Type, Email string
			Push        bool
		}
	}
	gql(t, author.c, `{ notifySettings { EmailEnabled HasEmail Items { Type Email Push } } }`, nil).field(t, "notifySettings", &settings)
	if settings.EmailEnabled || !settings.HasEmail || len(settings.Items) != 8 {
		t.Errorf("settings after unsubscribe = %+v", settings)
	}

	// The settings screen turns it back on and changes one type.
	r := gql(t, author.c, `mutation { updateNotifySettings(EmailEnabled: true, Items: [{Type: "reply", Email: "off", Push: false}]) { EmailEnabled Items { Type Email Push } } }`, nil)
	r.field(t, "updateNotifySettings", &settings)
	if !settings.EmailEnabled {
		t.Error("EmailEnabled not restored")
	}
	for _, it := range settings.Items {
		if it.Type == "reply" && (it.Email != "off" || it.Push) {
			t.Errorf("reply setting = %+v", it)
		}
		if it.Type == "comment" && it.Email != "digest" {
			t.Errorf("untouched comment setting changed: %+v", it)
		}
	}
}

func TestPushSubscriptions(t *testing.T) {
	var key struct {
		Enabled   bool
		PublicKey string
	}
	do(t, newClient(), "GET", apiURL+"/push/key", nil, &key)
	if !key.Enabled || len(key.PublicKey) < 60 {
		t.Fatalf("push key = %+v", key)
	}
	sub := map[string]interface{}{
		"endpoint": "https://push.example.test/e2e/" + runID,
		"keys":     map[string]string{"p256dh": "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", "auth": "tBHItJI5svbpez7KI4CCXg"},
	}
	if code := do(t, newClient(), "POST", apiURL+"/push/subscription", sub, nil); code != http.StatusUnauthorized {
		t.Errorf("anonymous subscribe = %d, want 401", code)
	}
	u := signup(t, "push")
	if code := do(t, u.c, "POST", apiURL+"/push/subscription", sub, nil); code != http.StatusCreated {
		t.Errorf("subscribe = %d", code)
	}
	bad := map[string]interface{}{"endpoint": "http://insecure.test/x", "keys": sub["keys"]}
	if code := do(t, u.c, "POST", apiURL+"/push/subscription", bad, nil); code != http.StatusBadRequest {
		t.Errorf("http endpoint = %d, want 400", code)
	}
	if code := do(t, u.c, "DELETE", apiURL+"/push/subscription", map[string]string{"endpoint": sub["endpoint"].(string)}, nil); code != http.StatusOK {
		t.Errorf("unsubscribe = %d", code)
	}
}
