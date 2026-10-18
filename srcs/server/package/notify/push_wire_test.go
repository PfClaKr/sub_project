package notify

import (
	"crypto/ecdh"
	"crypto/rand"
	"encoding/base64"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
)

// TestPushOnTheWire sends a real (encrypted, VAPID-signed) push to a
// local stand-in for a browser push service and checks the request is
// what push services accept: POST, aes128gcm body, TTL and a vapid
// Authorization naming our public key.
func TestPushOnTheWire(t *testing.T) {
	private, public, err := GenerateVAPIDKeys()
	if err != nil {
		t.Fatal(err)
	}
	t.Setenv("VAPID_PUBLIC_KEY", public)
	t.Setenv("VAPID_PRIVATE_KEY", private)
	t.Setenv("VAPID_SUBJECT", "mailto:test@itnyang.test")

	type seen struct {
		method, encoding, ttl, auth string
		size                        int
	}
	got := make(chan seen, 1)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		got <- seen{r.Method, r.Header.Get("Content-Encoding"), r.Header.Get("TTL"), r.Header.Get("Authorization"), len(body)}
		w.WriteHeader(http.StatusCreated)
	}))
	defer srv.Close()

	// A browser's subscription keys: a P-256 public key and a 16-byte secret.
	browserKey, _ := ecdh.P256().GenerateKey(rand.Reader)
	secret := make([]byte, 16)
	rand.Read(secret)

	n, f := newTest(member(nil))
	f.subs = []dynamo.Item{{
		"Endpoint": {S: aws.String(srv.URL + "/push/abc")},
		"P256dh":   {S: aws.String(base64.RawURLEncoding.EncodeToString(browserKey.PublicKey().Bytes()))},
		"Auth":     {S: aws.String(base64.RawURLEncoding.EncodeToString(secret))},
	}}
	n.deliverPush("author", "ko", Notification{Type: TypeAccepted, Preview: "채택됐어요", Link: "/community/p1"})

	s := <-got
	if s.method != http.MethodPost || s.encoding != "aes128gcm" || s.ttl != "86400" || s.size < 100 {
		t.Errorf("push request = %+v", s)
	}
	if !strings.HasPrefix(s.auth, "vapid t=") || !strings.Contains(s.auth, "k="+public) {
		t.Errorf("Authorization = %q, want a vapid header with our key", s.auth)
	}
	if f.deletes != 0 {
		t.Error("a delivered subscription was deleted")
	}
}
