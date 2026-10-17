//go:build e2e

package e2e

import (
	"net/http"
	"testing"
)

// A suspended member can log in and read, but every write is refused
// (GraphQL mutations, uploads, starting a chat, the chat socket) until an
// admin reinstates them.
func TestSuspension(t *testing.T) {
	seller := signup(t, "susp-seller")
	member := signup(t, "susp-member")
	admin := signup(t, "susp-admin")
	promoteAdmin(t, admin.Email)
	t.Cleanup(func() {
		do(t, admin.c, "DELETE", apiURL+"/admin/users/"+member.ID, nil, nil)
		do(t, admin.c, "DELETE", apiURL+"/admin/users/"+seller.ID, nil, nil)
	})
	p := newProduct(t, seller, "e2e 정지 테스트 "+runID, 5, "기타")

	if code := do(t, member.c, "PUT", apiURL+"/admin/users/"+seller.ID+"/suspension", map[string]int{"Days": 7}, nil); code != http.StatusForbidden {
		t.Errorf("member suspending someone = %d, want 403", code)
	}
	if code := do(t, admin.c, "PUT", apiURL+"/admin/users/"+member.ID+"/suspension", map[string]int{"Days": 7}, nil); code != http.StatusOK {
		t.Fatalf("suspend = %d", code)
	}

	var me map[string]interface{}
	do(t, member.c, "GET", loginURL+"/whoami", nil, &me)
	if me["Suspended"] != true || me["SuspendedUntil"].(float64) <= 0 {
		t.Errorf("whoami of a suspended member = %v", me)
	}

	r := gql(t, member.c, createProduct, map[string]interface{}{"n": "정지 중 등록", "p": 1.0, "c": "기타"})
	if r.err() != "이용이 정지된 계정이에요." {
		t.Errorf("createProduct while suspended: %q", r.err())
	}
	if code := do(t, member.c, "POST", apiURL+"/upload", nil, nil); code != http.StatusForbidden {
		t.Errorf("upload while suspended = %d, want 403", code)
	}
	if code := do(t, member.c, "GET", chatURL+"/room/product/"+p.ProductId, nil, nil); code != http.StatusForbidden {
		t.Errorf("starting a chat while suspended = %d, want 403", code)
	}
	// Reading still works.
	if r := gql(t, member.c, `{ unreadCount }`, nil); r.err() != "" {
		t.Errorf("unreadCount while suspended: %s", r.err())
	}

	var list struct{ Items []map[string]interface{} }
	do(t, admin.c, "GET", apiURL+"/admin/users?status=suspended&q="+q(member.Email), nil, &list)
	if len(list.Items) != 1 || list.Items[0]["Status"] != "suspended" {
		t.Errorf("suspended filter = %v", list.Items)
	}

	if code := do(t, admin.c, "DELETE", apiURL+"/admin/users/"+member.ID+"/suspension", nil, nil); code != http.StatusOK {
		t.Fatalf("reinstate = %d", code)
	}
	if code := do(t, member.c, "GET", chatURL+"/room/product/"+p.ProductId, nil, nil); code != http.StatusCreated && code != http.StatusOK {
		t.Errorf("chat after reinstatement = %d", code)
	}
}

func TestNotificationsAPI(t *testing.T) {
	if r := gql(t, newClient(), `{ unreadCount }`, nil); r.err() != "" || string(r.Data["unreadCount"]) != "0" {
		t.Errorf("anonymous unreadCount = %s %s", r.Data["unreadCount"], r.err())
	}
	if r := gql(t, newClient(), `{ notifications { Next } }`, nil); r.err() != "로그인이 필요해요." {
		t.Errorf("anonymous notifications: %q", r.err())
	}

	u := signup(t, "notif")
	var page struct {
		Items []map[string]interface{}
		Next  string
	}
	r := gql(t, u.c, `{ notifications { Items { SortKey Type Read } Next } }`, nil)
	r.field(t, "notifications", &page)
	if len(page.Items) != 0 || page.Next != "" {
		t.Errorf("new member notifications = %+v", page)
	}
	if r := gql(t, u.c, `mutation { markNotificationsRead }`, nil); r.err() != "" || string(r.Data["markNotificationsRead"]) != "0" {
		t.Errorf("markNotificationsRead = %s %s", r.Data["markNotificationsRead"], r.err())
	}
}

// Chat rooms are about a subject; product rooms keep their old route and
// ids, unknown kinds and missing posts are rejected.
func TestChatSubjects(t *testing.T) {
	seller := signup(t, "subj-seller")
	buyer := signup(t, "subj-buyer")
	p := newProduct(t, seller, "e2e 채팅 대상 "+runID, 3, "기타")

	var room map[string]interface{}
	if code := do(t, buyer.c, "GET", chatURL+"/room/product/"+p.ProductId, nil, &room); code != http.StatusCreated {
		t.Fatalf("product room = %d", code)
	}
	if room["SubjectType"] != "product" || room["SubjectId"] != p.ProductId || room["ProductId"] != p.ProductId {
		t.Errorf("room = %v", room)
	}

	var views []map[string]interface{}
	do(t, buyer.c, "GET", chatURL+"/rooms", nil, &views)
	found := false
	for _, v := range views {
		if v["ChatId"] == room["ChatId"] {
			found = true
			if v["SubjectTitle"] != p.ProductName || v["ProductName"] != p.ProductName {
				t.Errorf("room view titles = %v / %v", v["SubjectTitle"], v["ProductName"])
			}
		}
	}
	if !found {
		t.Error("new room missing from /rooms")
	}

	if code := do(t, buyer.c, "GET", chatURL+"/room/spaceship/x", nil, nil); code != http.StatusNotFound {
		t.Errorf("unknown subject = %d, want 404", code)
	}
	if code := do(t, buyer.c, "GET", chatURL+"/room/housing/no-such-post", nil, nil); code != http.StatusNotFound {
		t.Errorf("missing housing post = %d, want 404", code)
	}
}
