//go:build e2e

package e2e

import (
	"net/http"
	"testing"
)

// Leaving (DELETE /account): the account and products go at once, the
// session ends, community posts stay as "탈퇴한 회원" and the other member
// still sees the chat. Admins cannot leave this way.
func TestLeave(t *testing.T) {
	member, other := signup(t, "leaver"), signup(t, "leaveother")
	p := newProduct(t, member, "e2e 탈퇴 상품 "+runID, 9, "기타")
	post := newPost(t, member, "free", "일상", "e2e 탈퇴 전에 쓴 글 "+runID, false)
	otherProduct := newProduct(t, other, "e2e 탈퇴 채팅 상품 "+runID, 8, "기타")
	var room map[string]interface{}
	do(t, member.c, "GET", chatURL+"/room/product/"+otherProduct.ProductId, nil, &room)
	chatId, _ := room["ChatId"].(string)

	if code := do(t, newClient(), "DELETE", apiURL+"/account", nil, nil); code != http.StatusUnauthorized {
		t.Errorf("leave without a session = %d, want 401", code)
	}
	if code := do(t, member.c, "DELETE", apiURL+"/account", nil, nil); code != http.StatusOK {
		t.Fatalf("leave = %d", code)
	}
	if code := do(t, member.c, "GET", loginURL+"/whoami", nil, nil); code != http.StatusUnauthorized {
		t.Errorf("still logged in after leaving: %d", code)
	}
	if code := do(t, newClient(), "POST", loginURL+"/login", map[string]string{"email": member.Email, "password": "password123"}, nil); code != http.StatusUnauthorized {
		t.Errorf("login after leaving = %d, want 401", code)
	}

	var got struct{ Product *product }
	gql(t, newClient(), `query($id: String!) { product(ProductId: $id) { ProductId } }`, map[string]interface{}{"id": p.ProductId}).field(t, "product", &got.Product)
	if got.Product != nil {
		t.Error("the product survived its seller leaving")
	}
	var kept struct {
		Post struct{ PostId, AuthorNickname, AuthorId string }
	}
	gql(t, newClient(), `query($id: String!) { post(PostId: $id) { PostId AuthorNickname AuthorId } }`, map[string]interface{}{"id": post.PostId}).field(t, "post", &kept.Post)
	if kept.Post.PostId != post.PostId || kept.Post.AuthorNickname != "탈퇴한 회원" {
		t.Errorf("community post after leaving = %+v", kept.Post)
	}
	if chatId != "" {
		if code := do(t, other.c, "GET", chatURL+"/room/"+chatId, nil, nil); code != http.StatusOK {
			t.Errorf("the other member lost the chat: %d", code)
		}
	}

	admin := signup(t, "leaveadmin")
	promoteAdmin(t, admin.Email)
	if code := do(t, admin.c, "DELETE", apiURL+"/account", nil, nil); code != http.StatusBadRequest {
		t.Errorf("admin leaving = %d, want 400", code)
	}
}
