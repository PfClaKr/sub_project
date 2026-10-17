//go:build e2e

package e2e

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// Chat safety: a member reports a conversation (admins see it with a
// link to the transcript) and blocks the other member, after which
// neither can send messages or start a new chat until unblocked.
func TestChatReportAndBlock(t *testing.T) {
	seller, buyer, outsider := signup(t, "blkseller"), signup(t, "blkbuyer"), signup(t, "blkout")
	admin := signup(t, "blkadmin")
	promoteAdmin(t, admin.Email)
	p := newProduct(t, seller, "e2e 차단 테스트 "+runID, 12, "기타")
	p2 := newProduct(t, seller, "e2e 차단 테스트 2 "+runID, 13, "기타")

	var room map[string]interface{}
	do(t, buyer.c, "GET", chatURL+"/room/product/"+p.ProductId, nil, &room)
	chatId := room["ChatId"].(string)
	b := dial(t, buyer, chatId)
	b.WriteMessage(websocket.TextMessage, []byte(`{"Message":"선입금 먼저 보내주세요 `+runID+`"}`))
	time.Sleep(300 * time.Millisecond)

	// Report: members only, once.
	report := `mutation($id: String!) { report(TargetType: "chat", TargetId: $id, Reason: "사기 의심") }`
	if r := gql(t, outsider.c, report, map[string]interface{}{"id": chatId}); r.err() == "" {
		t.Error("an outsider reported a conversation")
	}
	if r := gql(t, seller.c, report, map[string]interface{}{"id": chatId}); r.err() != "" {
		t.Fatalf("report chat: %s", r.err())
	}
	if r := gql(t, seller.c, report, map[string]interface{}{"id": chatId}); r.err() == "" {
		t.Error("reported the same conversation twice")
	}
	var queue struct {
		Items []struct{ TargetId, Link, OwnerId, Body string }
	}
	do(t, admin.c, "GET", apiURL+"/admin/reports?type=chat", nil, &queue)
	found := false
	for _, it := range queue.Items {
		if it.TargetId == chatId {
			found = true
			if it.Link != "/admin/conversations/"+chatId || it.OwnerId != buyer.ID || !strings.Contains(it.Body, "선입금") {
				t.Errorf("queue item = %+v", it)
			}
		}
	}
	if !found {
		t.Fatal("chat report missing from the admin queue")
	}
	if code := do(t, admin.c, "POST", apiURL+"/admin/reports/resolve", map[string]string{"TargetType": "chat", "TargetId": chatId, "Action": "resolve"}, nil); code != http.StatusOK {
		t.Errorf("resolve chat report = %d", code)
	}

	// Block.
	if code := do(t, seller.c, "PUT", chatURL+"/blocks/"+seller.ID, nil, nil); code != http.StatusBadRequest {
		t.Errorf("blocking yourself = %d, want 400", code)
	}
	if code := do(t, seller.c, "PUT", chatURL+"/blocks/"+buyer.ID, nil, nil); code != http.StatusOK {
		t.Fatalf("block = %d", code)
	}
	var view map[string]interface{}
	do(t, seller.c, "GET", chatURL+"/room/"+chatId, nil, &view)
	if view["BlockedByMe"] != true || view["Blocked"] != true {
		t.Errorf("blocker's room view = %v", view)
	}
	view = nil
	do(t, buyer.c, "GET", chatURL+"/room/"+chatId, nil, &view)
	if view["BlockedByMe"] == true || view["Blocked"] != true {
		t.Errorf("blocked member's room view = %v", view)
	}
	var list []map[string]interface{}
	do(t, seller.c, "GET", chatURL+"/blocks", nil, &list)
	if len(list) != 1 || list[0]["UserId"] != buyer.ID || list[0]["UserNickname"] != buyer.Nickname {
		t.Errorf("block list = %v", list)
	}

	// The open socket refuses new messages, and no new room can start.
	b.WriteMessage(websocket.TextMessage, []byte(`{"Message":"차단 후 메시지 `+runID+`"}`))
	b.SetReadDeadline(time.Now().Add(5 * time.Second))
	for {
		_, raw, err := b.ReadMessage()
		if err != nil {
			t.Fatalf("no refusal frame: %v", err)
		}
		if strings.Contains(string(raw), `"Error":"blocked"`) {
			break
		}
	}
	var history []map[string]interface{}
	do(t, seller.c, "GET", chatURL+"/history/"+chatId, nil, &history)
	for _, m := range history {
		if strings.Contains(m["Content"].(string), "차단 후") {
			t.Error("a message after the block was stored")
		}
	}
	var refused map[string]string
	if code := do(t, buyer.c, "GET", chatURL+"/room/product/"+p2.ProductId, nil, &refused); code != http.StatusForbidden || refused["error"] != "대화할 수 없는 상대예요." {
		t.Errorf("new room while blocked = %d %v", code, refused)
	}

	// Unblock restores both.
	if code := do(t, seller.c, "DELETE", chatURL+"/blocks/"+buyer.ID, nil, nil); code != http.StatusOK {
		t.Fatalf("unblock = %d", code)
	}
	if code := do(t, buyer.c, "GET", chatURL+"/room/product/"+p2.ProductId, nil, nil); code != http.StatusCreated {
		t.Errorf("new room after unblock = %d", code)
	}
}
