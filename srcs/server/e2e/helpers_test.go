//go:build e2e

// Package e2e runs API scenarios against a running stack
// (make up / docker compose): `go test -tags e2e ./...`.
package e2e

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"testing"
	"time"
)

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

var (
	apiURL   = env("E2E_API", "http://localhost:8080")
	loginURL = env("E2E_LOGIN", "http://localhost:7070")
	chatURL  = env("E2E_CHAT", "http://localhost:9090")
	origin   = env("E2E_ORIGIN", "http://localhost:3000")
	mailhog  = env("E2E_MAILHOG", "http://localhost:8025")
)

// runID keeps names and emails unique across runs on a shared database.
var runID = fmt.Sprintf("%d%04d", time.Now().Unix()%100000, rand.Intn(10000))

type user struct {
	Email, Nickname, ID string
	c                   *http.Client
}

func newClient() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Jar: jar, Timeout: 20 * time.Second}
}

// do sends a request and decodes a JSON answer into out (may be nil).
func do(t *testing.T, c *http.Client, method, u string, body, out interface{}) int {
	t.Helper()
	var r io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		r = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, u, r)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Origin", origin)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := c.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, u, err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	if out != nil && len(raw) > 0 {
		if err := json.Unmarshal(raw, out); err != nil {
			t.Fatalf("%s %s: decode %q: %v", method, u, raw, err)
		}
	}
	return res.StatusCode
}

func newUser(tag string) *user {
	return &user{Email: fmt.Sprintf("e2e-%s-%s@test.itnyang", tag, runID), Nickname: "e2e" + tag + runID[len(runID)-4:], c: newClient()}
}

// register calls /signup and returns its JSON answer.
func register(t *testing.T, u *user) map[string]string {
	t.Helper()
	var res map[string]string
	if code := do(t, u.c, "POST", loginURL+"/signup", map[string]string{
		"email": u.Email, "password": "password123", "usernickname": u.Nickname, "residence": "파리",
	}, &res); code != http.StatusCreated {
		t.Fatalf("signup %s = %d %v", u.Email, code, res)
	}
	u.ID = res["UserId"]
	return res
}

// signup registers a user and, when email verification is on, verifies
// the address through MailHog and logs in.
func signup(t *testing.T, tag string) *user {
	t.Helper()
	u := newUser(tag)
	if register(t, u)["next"] == "verify-email" {
		verifyEmail(t, u)
		login(t, u)
	}
	return u
}

func login(t *testing.T, u *user) {
	t.Helper()
	var res map[string]string
	if code := do(t, u.c, "POST", loginURL+"/login", map[string]string{"email": u.Email, "password": "password123"}, &res); code != http.StatusOK {
		t.Fatalf("login %s = %d %v", u.Email, code, res)
	}
}

var tokenInMail = regexp.MustCompile(`token=([0-9a-f]{64})`)

// mailToken reads the verification link sent to email from MailHog.
func mailToken(t *testing.T, email string) string {
	t.Helper()
	for i := 0; i < 20; i++ {
		var found struct {
			Items []struct {
				Content struct{ Body string }
			}
		}
		do(t, newClient(), "GET", mailhog+"/api/v2/search?kind=to&query="+q(email), nil, &found)
		for _, m := range found.Items {
			// Bodies may be quoted-printable (soft line breaks "=\r\n").
			body := strings.ReplaceAll(m.Content.Body, "=\r\n", "")
			if sub := tokenInMail.FindStringSubmatch(body); sub != nil {
				return sub[1]
			}
		}
		time.Sleep(250 * time.Millisecond)
	}
	t.Fatalf("no verification mail for %s in MailHog (%s)", email, mailhog)
	return ""
}

func verifyEmail(t *testing.T, u *user) {
	t.Helper()
	if code := do(t, newClient(), "GET", loginURL+"/verify?token="+mailToken(t, u.Email), nil, nil); code != http.StatusOK {
		t.Fatalf("verify %s = %d", u.Email, code)
	}
}

type gqlResult struct {
	Data   map[string]json.RawMessage `json:"data"`
	Errors []struct{ Message string } `json:"errors"`
}

func (r gqlResult) err() string {
	if len(r.Errors) == 0 {
		return ""
	}
	return r.Errors[0].Message
}

// field decodes one top-level field of the data.
func (r gqlResult) field(t *testing.T, name string, out interface{}) {
	t.Helper()
	if err := json.Unmarshal(r.Data[name], out); err != nil {
		t.Fatalf("decode %s: %v (errors: %v)", name, err, r.Errors)
	}
}

func gql(t *testing.T, c *http.Client, query string, vars map[string]interface{}) gqlResult {
	t.Helper()
	var r gqlResult
	if code := do(t, c, "POST", apiURL+"/graphql", map[string]interface{}{"query": query, "variables": vars}, &r); code != http.StatusOK {
		t.Fatalf("graphql status %d", code)
	}
	return r
}

type product struct {
	ProductId, ProductName, ProductStatus, UserId, SellerNickname string
	ProductPrice                                                  float64
}

const createProduct = `mutation($n: String!, $p: Float!, $c: String!) {
	createProduct(ProductName: $n, ProductDescription: "e2e", ProductPrice: $p, ProductCategory: $c, PreferedLocation: "Paris 15e") { ProductId ProductName ProductStatus UserId }
}`

// newProduct creates a listing and deletes it when the test ends.
func newProduct(t *testing.T, u *user, name string, price float64, category string) product {
	t.Helper()
	r := gql(t, u.c, createProduct, map[string]interface{}{"n": name, "p": price, "c": category})
	var p product
	r.field(t, "createProduct", &p)
	if p.ProductId == "" {
		t.Fatalf("createProduct %q: %s", name, r.err())
	}
	t.Cleanup(func() {
		gql(t, u.c, `mutation($id: String!) { deleteProduct(ProductId: $id) }`, map[string]interface{}{"id": p.ProductId})
	})
	return p
}

type searchResult struct {
	Products  []product
	Corrected bool
}

func search(t *testing.T, q string, extra map[string]interface{}) searchResult {
	t.Helper()
	vars := map[string]interface{}{"q": q}
	for k, v := range extra {
		vars[k] = v
	}
	r := gql(t, newClient(), `query($q: String!, $sort: String, $cat: String) {
		productSearch(ProductName: $q, Sort: $sort, Category: $cat) { Corrected Products { ProductId ProductName ProductPrice } }
	}`, vars)
	var s searchResult
	r.field(t, "productSearch", &s)
	return s
}

func ids(ps []product) []string {
	out := make([]string, len(ps))
	for i, p := range ps {
		out[i] = p.ProductId
	}
	return out
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}

// promoteAdmin uses the CLI, the only way to create an admin. It needs
// E2E_COMPOSE_FILE (the stack's compose file) to reach the container.
func promoteAdmin(t *testing.T, email string) {
	t.Helper()
	file := os.Getenv("E2E_COMPOSE_FILE")
	if file == "" {
		t.Skip("E2E_COMPOSE_FILE not set; cannot run promote-admin")
	}
	out, err := exec.Command("docker", "compose", "-f", file, "exec", "-T", "apiserver", "/main", "promote-admin", email).CombinedOutput()
	if err != nil {
		t.Fatalf("promote-admin: %v: %s", err, out)
	}
}

func q(v string) string { return url.QueryEscape(v) }
