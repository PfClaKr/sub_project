//go:build e2e

package e2e

import (
	"net/http"
	"testing"
)

func TestHealth(t *testing.T) {
	for _, u := range []string{apiURL, loginURL, chatURL} {
		if code := do(t, newClient(), "GET", u+"/healthz", nil, nil); code != http.StatusOK {
			t.Errorf("%s/healthz = %d", u, code)
		}
	}
}

func TestAuth(t *testing.T) {
	u := newUser("auth")
	if register(t, u)["next"] == "verify-email" {
		// Not logged in, and login is refused until the email is verified.
		if code := do(t, u.c, "GET", loginURL+"/whoami", nil, nil); code != http.StatusUnauthorized {
			t.Errorf("whoami before verification = %d, want 401", code)
		}
		var res map[string]string
		if code := do(t, u.c, "POST", loginURL+"/login", map[string]string{"email": u.Email, "password": "password123"}, &res); code != http.StatusForbidden || res["code"] != "EMAIL_NOT_VERIFIED" {
			t.Errorf("login before verification = %d %v, want 403 EMAIL_NOT_VERIFIED", code, res)
		}
		verifyEmail(t, u)
		// Opening the link again still succeeds.
		verifyEmail(t, u)
		if code := do(t, newClient(), "GET", loginURL+"/verify?token=0000000000000000000000000000000000000000000000000000000000000000", nil, nil); code != http.StatusBadRequest {
			t.Errorf("bogus verify token = %d, want 400", code)
		}
	}
	login(t, u)

	var me map[string]string
	if code := do(t, u.c, "GET", loginURL+"/whoami", nil, &me); code != http.StatusOK || me["UserId"] != u.ID || me["Residence"] != "파리" {
		t.Fatalf("whoami = %d %v", code, me)
	}

	// The same email (other case) must not replace the account.
	var dup map[string]string
	if code := do(t, newClient(), "POST", loginURL+"/signup", map[string]string{
		"email": "  " + upper(u.Email), "password": "hijacker123", "usernickname": "hijacker",
	}, &dup); code != http.StatusConflict {
		t.Errorf("duplicate signup = %d, want 409", code)
	}
	if code := do(t, newClient(), "POST", loginURL+"/login", map[string]string{"email": u.Email, "password": "password123"}, nil); code != http.StatusOK {
		t.Errorf("original password no longer works: %d", code)
	}

	// Unknown email and wrong password look the same.
	var wrong, unknown map[string]string
	do(t, newClient(), "POST", loginURL+"/login", map[string]string{"email": u.Email, "password": "nope-nope"}, &wrong)
	do(t, newClient(), "POST", loginURL+"/login", map[string]string{"email": "nobody-" + u.Email, "password": "nope-nope"}, &unknown)
	if wrong["error"] == "" || wrong["error"] != unknown["error"] {
		t.Errorf("login errors differ: %q vs %q", wrong["error"], unknown["error"])
	}

	if code := do(t, newClient(), "POST", loginURL+"/signup", map[string]string{"email": "bad", "password": "1", "usernickname": "x"}, nil); code != http.StatusBadRequest {
		t.Errorf("invalid signup = %d, want 400", code)
	}

	req, _ := http.NewRequest("GET", chatURL+"/rooms", nil)
	req.Header.Set("Cookie", "token=forged.token.value")
	if res, err := http.DefaultClient.Do(req); err != nil || res.StatusCode != http.StatusUnauthorized {
		t.Errorf("forged token: %v %v, want 401", res.StatusCode, err)
	}

	do(t, u.c, "POST", loginURL+"/logout", nil, nil)
	if code := do(t, u.c, "GET", loginURL+"/whoami", nil, nil); code != http.StatusUnauthorized {
		t.Errorf("whoami after logout = %d, want 401", code)
	}
}

func upper(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'a' && c <= 'z' {
			b[i] = c - 32
		}
	}
	return string(b)
}

func TestProductOwnership(t *testing.T) {
	seller, other := signup(t, "seller"), signup(t, "other")

	if r := gql(t, newClient(), createProduct, map[string]interface{}{"n": "anon", "p": 1.0, "c": "기타"}); r.err() == "" {
		t.Error("anonymous createProduct must fail")
	}
	if r := gql(t, seller.c, createProduct, map[string]interface{}{"n": "bad cat", "p": 1.0, "c": "무기"}); r.err() == "" {
		t.Error("unknown category must be rejected")
	}

	p := newProduct(t, seller, "e2e 권한 테스트 "+runID, 10, "가구")
	if p.UserId != seller.ID || p.ProductStatus != "판매중" {
		t.Errorf("created product = %+v", p)
	}

	for name, m := range map[string]string{
		"status": `mutation($id: String!) { updateProductStatus(ProductId: $id, ProductStatus: "판매완료") { ProductStatus } }`,
		"delete": `mutation($id: String!) { deleteProduct(ProductId: $id) }`,
		"update": `mutation($id: String!) { updateProduct(ProductId: $id, ProductName: "hacked", ProductDescription: "", ProductPrice: 1, ProductCategory: "가구", PreferedLocation: "x") { ProductName } }`,
	} {
		if r := gql(t, other.c, m, map[string]interface{}{"id": p.ProductId}); r.err() == "" {
			t.Errorf("non-owner %s must fail", name)
		}
	}

	r := gql(t, seller.c, `mutation($id: String!) { updateProductStatus(ProductId: $id, ProductStatus: "예약중") { ProductStatus } }`, map[string]interface{}{"id": p.ProductId})
	if r.err() != "" {
		t.Errorf("owner status change: %s", r.err())
	}

	var got struct {
		ProductStatus, SellerNickname string
	}
	gql(t, newClient(), `query($id: String!) { product(ProductId: $id) { ProductStatus SellerNickname } }`, map[string]interface{}{"id": p.ProductId}).field(t, "product", &got)
	if got.ProductStatus != "예약중" || got.SellerNickname != seller.Nickname {
		t.Errorf("product after update = %+v", got)
	}

	var u struct{ PublishedQuantity float64 }
	gql(t, newClient(), `query($id: String!) { user(UserId: $id) { PublishedQuantity } }`, map[string]interface{}{"id": seller.ID}).field(t, "user", &u)
	if u.PublishedQuantity != 1 {
		t.Errorf("PublishedQuantity = %v, want 1", u.PublishedQuantity)
	}

	if r := gql(t, newClient(), `query($id: String!) { user(UserId: $id) { Email } }`, map[string]interface{}{"id": seller.ID}); r.err() == "" {
		t.Error("User.Email must not be queryable")
	}
}

func TestDebugRoutesAreNotPublic(t *testing.T) {
	for _, path := range []string{"/tables", "/tables/UsersCredential", "/dummy/8", "/testjwt"} {
		if code := do(t, newClient(), "GET", apiURL+path, nil, nil); code != http.StatusNotFound {
			t.Errorf("GET %s = %d, want 404", path, code)
		}
	}
	// Even with debug routes on, credentials are never dumped.
	if code := do(t, newClient(), "GET", apiURL+"/debug/tables/UsersCredential", nil, nil); code == http.StatusOK {
		t.Error("credential table must never be exposed")
	}
}
