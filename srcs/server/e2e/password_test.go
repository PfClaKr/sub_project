//go:build e2e

package e2e

import (
	"net/http"
	"regexp"
	"strings"
	"testing"
	"time"
)

var resetInMail = regexp.MustCompile(`/account/reset\?email=[^&\s]+&token=([0-9a-f]{64})`)

// resetToken waits for a reset mail to email other than the skipped ones.
func resetToken(t *testing.T, email string, skip ...string) string {
	t.Helper()
	for i := 0; i < 40; i++ {
		var found struct {
			Items []struct{ Content struct{ Body string } }
		}
		do(t, newClient(), "GET", mailhog+"/api/v2/search?kind=to&query="+q(email), nil, &found)
		for _, m := range found.Items {
			body := strings.ReplaceAll(m.Content.Body, "=\r\n", "")
			body = strings.ReplaceAll(body, "=3D", "=")
			if sub := resetInMail.FindStringSubmatch(body); sub != nil && !contains(skip, sub[1]) {
				return sub[1]
			}
		}
		time.Sleep(250 * time.Millisecond)
	}
	t.Fatalf("no reset mail for %s", email)
	return ""
}

// Forgotten password: the mail link sets a new password once, logs the
// member in, and the old password stops working. Unknown addresses get
// the same answer. A logged-in member can change the password.
func TestPasswordReset(t *testing.T) {
	u := signup(t, "pwreset")

	var res map[string]string
	if code := do(t, newClient(), "POST", loginURL+"/password/forgot", map[string]string{"email": "nobody-" + runID + "@test.itnyang"}, &res); code != http.StatusOK {
		t.Errorf("forgot for an unknown address = %d, want the same 200", code)
	}
	if code := do(t, newClient(), "POST", loginURL+"/password/forgot", map[string]string{"email": strings.ToUpper(u.Email)}, nil); code != http.StatusOK {
		t.Fatalf("forgot = %d", code)
	}
	token := resetToken(t, u.Email)

	c := newClient()
	if code := do(t, c, "POST", loginURL+"/password/reset", map[string]string{"email": u.Email, "token": strings.Repeat("0", 64), "password": "newpassword1"}, nil); code != http.StatusBadRequest {
		t.Errorf("reset with a wrong token = %d, want 400", code)
	}
	if code := do(t, c, "POST", loginURL+"/password/reset", map[string]string{"email": u.Email, "token": token, "password": "short"}, nil); code != http.StatusBadRequest {
		t.Errorf("reset with a short password = %d, want 400", code)
	}
	if code := do(t, c, "POST", loginURL+"/password/reset", map[string]string{"email": u.Email, "token": token, "password": "newpassword1"}, nil); code != http.StatusOK {
		t.Fatalf("reset = %d", code)
	}
	var me map[string]interface{}
	if code := do(t, c, "GET", loginURL+"/whoami", nil, &me); code != http.StatusOK || me["UserId"] != u.ID {
		t.Errorf("not logged in after reset: %d %v", code, me)
	}
	if code := do(t, newClient(), "POST", loginURL+"/password/reset", map[string]string{"email": u.Email, "token": token, "password": "another1234"}, nil); code != http.StatusBadRequest {
		t.Errorf("reusing the link = %d, want 400", code)
	}
	if code := do(t, newClient(), "POST", loginURL+"/login", map[string]string{"email": u.Email, "password": "password123"}, nil); code != http.StatusUnauthorized {
		t.Errorf("old password still works: %d", code)
	}
	if code := do(t, newClient(), "POST", loginURL+"/login", map[string]string{"email": u.Email, "password": "newpassword1"}, nil); code != http.StatusOK {
		t.Errorf("new password refused: %d", code)
	}

	// Change while logged in.
	if code := do(t, c, "POST", loginURL+"/password/change", map[string]string{"current": "wrong-password", "password": "changed12345"}, nil); code != http.StatusBadRequest {
		t.Errorf("change with a wrong current password = %d, want 400", code)
	}
	if code := do(t, newClient(), "POST", loginURL+"/password/change", map[string]string{"current": "newpassword1", "password": "changed12345"}, nil); code != http.StatusUnauthorized {
		t.Errorf("change without a session = %d, want 401", code)
	}
	if code := do(t, c, "POST", loginURL+"/password/change", map[string]string{"current": "newpassword1", "password": "changed12345"}, nil); code != http.StatusOK {
		t.Fatalf("change = %d", code)
	}
	if code := do(t, newClient(), "POST", loginURL+"/login", map[string]string{"email": u.Email, "password": "changed12345"}, nil); code != http.StatusOK {
		t.Errorf("changed password refused: %d", code)
	}
}
