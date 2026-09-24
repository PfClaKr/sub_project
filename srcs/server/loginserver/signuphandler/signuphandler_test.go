package signuphandler

import (
	"strings"
	"testing"
)

func TestValidate(t *testing.T) {
	cases := []struct {
		name string
		req  SignupRequest
		ok   bool
	}{
		{"valid", SignupRequest{Email: "  A@B.com ", Password: "password1", UserNickname: " 잇냥 "}, true},
		{"bad email", SignupRequest{Email: "not-an-email", Password: "password1", UserNickname: "잇냥"}, false},
		{"display-name email", SignupRequest{Email: "Bob <a@b.com>", Password: "password1", UserNickname: "잇냥"}, false},
		{"short password", SignupRequest{Email: "a@b.com", Password: "short", UserNickname: "잇냥"}, false},
		{"short nickname", SignupRequest{Email: "a@b.com", Password: "password1", UserNickname: "a"}, false},
		{"long nickname", SignupRequest{Email: "a@b.com", Password: "password1", UserNickname: "가나다라마바사아자차카타파하가나다라마바사"}, false},
	}
	for _, c := range cases {
		req := c.req
		msg := req.Validate()
		if (msg == "") != c.ok {
			t.Errorf("%s: Validate() = %q, want ok=%v", c.name, msg, c.ok)
		}
	}

	req := SignupRequest{Email: "  A@B.com ", Password: "password1", UserNickname: " 잇냥 "}
	req.Validate()
	if req.Email != "a@b.com" || req.UserNickname != "잇냥" || req.Residence != DefaultResidence {
		t.Errorf("not normalized: %+v", req)
	}

	long := SignupRequest{Email: "a@b.com", Password: "password1", UserNickname: "잇냥", Residence: strings.Repeat("가", 31)}
	if long.Validate() == "" {
		t.Error("overlong residence must be rejected")
	}
}
