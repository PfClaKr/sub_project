//go:build e2e

package e2e

import (
	"net/http"
	"testing"
)

func TestAdmin(t *testing.T) {
	member := signup(t, "member")
	for _, path := range []string{"/admin/stats", "/admin/users", "/admin/products", "/admin/conversations"} {
		if code := do(t, newClient(), "GET", apiURL+path, nil, nil); code != http.StatusUnauthorized {
			t.Errorf("anonymous %s = %d, want 401", path, code)
		}
		if code := do(t, member.c, "GET", apiURL+path, nil, nil); code != http.StatusForbidden {
			t.Errorf("member %s = %d, want 403", path, code)
		}
	}

	admin := signup(t, "admin")
	promoteAdmin(t, admin.Email)
	t.Cleanup(func() {
		do(t, admin.c, "DELETE", apiURL+"/admin/users/"+member.ID, nil, nil)
	})

	var me map[string]string
	do(t, admin.c, "GET", loginURL+"/whoami", nil, &me)
	if me["Role"] != "admin" {
		t.Fatalf("whoami Role = %q, want admin", me["Role"])
	}

	var stats map[string]float64
	if code := do(t, admin.c, "GET", apiURL+"/admin/stats", nil, &stats); code != http.StatusOK || stats["Users"] < 2 {
		t.Errorf("stats = %d %v", code, stats)
	}

	var users struct {
		Items []map[string]interface{}
		Total int
	}
	do(t, admin.c, "GET", apiURL+"/admin/users?q="+q(member.Email), nil, &users)
	if users.Total != 1 || users.Items[0]["UserId"] != member.ID {
		t.Errorf("user search = %+v", users)
	}

	if code := do(t, admin.c, "DELETE", apiURL+"/admin/users/"+admin.ID, nil, nil); code != http.StatusBadRequest {
		t.Errorf("deleting self = %d, want 400", code)
	}
	if code := do(t, admin.c, "PATCH", apiURL+"/admin/users/"+admin.ID, map[string]string{"Role": "user"}, nil); code != http.StatusBadRequest {
		t.Errorf("demoting self = %d, want 400", code)
	}

	p := newProduct(t, member, "e2e 관리자 테스트 "+runID, 12, "기타")
	if code := do(t, admin.c, "PATCH", apiURL+"/admin/products/"+p.ProductId, map[string]string{"ProductStatus": "판매완료"}, nil); code != http.StatusOK {
		t.Errorf("admin status change = %d", code)
	}
	var got struct{ ProductStatus string }
	gql(t, newClient(), `query($id: String!) { product(ProductId: $id) { ProductStatus } }`, map[string]interface{}{"id": p.ProductId}).field(t, "product", &got)
	if got.ProductStatus != "판매완료" {
		t.Errorf("status after admin change = %q", got.ProductStatus)
	}

	// Deleting the member removes their listing too.
	if code := do(t, admin.c, "DELETE", apiURL+"/admin/users/"+member.ID, nil, nil); code != http.StatusOK {
		t.Fatalf("delete member = %d", code)
	}
	if r := gql(t, newClient(), `query($id: String!) { product(ProductId: $id) { ProductId } }`, map[string]interface{}{"id": p.ProductId}); string(r.Data["product"]) != "null" {
		t.Errorf("member's product survived deletion: %s", r.Data["product"])
	}
	if code := do(t, newClient(), "POST", loginURL+"/login", map[string]string{"email": member.Email, "password": "password123"}, nil); code != http.StatusUnauthorized {
		t.Errorf("deleted member can still log in: %d", code)
	}
}
