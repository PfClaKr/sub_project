//go:build e2e

package e2e

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestFavorites(t *testing.T) {
	seller, buyer := signup(t, "favseller"), signup(t, "favbuyer")
	p := newProduct(t, seller, "e2e 찜 테스트 "+runID, 20, "도서")

	if code := do(t, newClient(), "POST", apiURL+"/favorites/"+p.ProductId, nil, nil); code != http.StatusUnauthorized {
		t.Errorf("anonymous favorite = %d, want 401", code)
	}
	if code := do(t, buyer.c, "POST", apiURL+"/favorites/"+p.ProductId, nil, nil); code != http.StatusCreated {
		t.Fatalf("favorite = %d", code)
	}
	if code := do(t, buyer.c, "POST", apiURL+"/favorites/no-such-product", nil, nil); code != http.StatusNotFound {
		t.Errorf("favorite unknown product = %d, want 404", code)
	}
	var list []map[string]interface{}
	do(t, buyer.c, "GET", apiURL+"/favorites", nil, &list)
	if len(list) != 1 || list[0]["ProductId"] != p.ProductId {
		t.Errorf("favorites = %v", list)
	}
	do(t, buyer.c, "DELETE", apiURL+"/favorites/"+p.ProductId, nil, nil)
	do(t, buyer.c, "GET", apiURL+"/favorites", nil, &list)
	if len(list) != 0 {
		t.Errorf("favorites after removal = %v", list)
	}
}

func token(t *testing.T, u *user) string {
	t.Helper()
	parsed, _ := http.NewRequest("GET", chatURL, nil)
	for _, c := range u.c.Jar.Cookies(parsed.URL) {
		if c.Name == "token" {
			return c.Value
		}
	}
	t.Fatal("no token cookie")
	return ""
}

func dial(t *testing.T, u *user, chatId string) *websocket.Conn {
	t.Helper()
	h := http.Header{"Cookie": {"token=" + token(t, u)}, "Origin": {origin}}
	conn, _, err := websocket.DefaultDialer.Dial(strings.Replace(chatURL, "http", "ws", 1)+"/ws/"+chatId, h)
	if err != nil {
		t.Fatalf("websocket: %v", err)
	}
	t.Cleanup(func() { conn.Close() })
	return conn
}

func TestChat(t *testing.T) {
	seller, buyer, outsider := signup(t, "chatseller"), signup(t, "chatbuyer"), signup(t, "outsider")
	p := newProduct(t, seller, "e2e 채팅 테스트 "+runID, 30, "기타")

	var room, again map[string]interface{}
	if code := do(t, buyer.c, "GET", chatURL+"/room/product/"+p.ProductId, nil, &room); code != http.StatusCreated {
		t.Fatalf("open room = %d %v", code, room)
	}
	do(t, buyer.c, "GET", chatURL+"/room/product/"+p.ProductId, nil, &again)
	if room["ChatId"] != again["ChatId"] {
		t.Errorf("second open created another room: %v vs %v", room["ChatId"], again["ChatId"])
	}
	chatId := room["ChatId"].(string)

	if code := do(t, seller.c, "GET", chatURL+"/room/product/"+p.ProductId, nil, nil); code != http.StatusBadRequest {
		t.Errorf("seller chatting on own product = %d, want 400", code)
	}
	for _, path := range []string{"/room/", "/history/"} {
		if code := do(t, outsider.c, "GET", chatURL+path+chatId, nil, nil); code != http.StatusNotFound {
			t.Errorf("outsider %s = %d, want 404", path, code)
		}
	}

	var view map[string]interface{}
	do(t, seller.c, "GET", chatURL+"/room/"+chatId, nil, &view)
	if view["BuyerNickname"] != buyer.Nickname || view["ProductName"] != p.ProductName {
		t.Errorf("room view = %v", view)
	}

	b, s := dial(t, buyer, chatId), dial(t, seller, chatId)
	msg := "안녕하세요 " + runID
	if err := b.WriteMessage(websocket.TextMessage, []byte(`{"Message":"`+msg+`"}`)); err != nil {
		t.Fatal(err)
	}
	s.SetReadDeadline(time.Now().Add(10 * time.Second))
	_, raw, err := s.ReadMessage()
	if err != nil || !strings.Contains(string(raw), msg) {
		t.Fatalf("seller did not receive the message: %v %s", err, raw)
	}

	var history []map[string]interface{}
	do(t, seller.c, "GET", chatURL+"/history/"+chatId, nil, &history)
	if len(history) != 1 || history[0]["Content"] != msg || history[0]["Timestamp"].(float64) < 1e12 {
		t.Errorf("history = %v (want one message with a ms timestamp)", history)
	}
}
