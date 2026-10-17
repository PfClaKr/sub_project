package mailer

import (
	"strings"
	"testing"
)

func TestBuild(t *testing.T) {
	msg := string(build("no-reply@itnyang.test", Message{
		To:      "a@b.c",
		Subject: "[잇냥] 새 댓글",
		Body:    "본문",
		Headers: map[string]string{
			"List-Unsubscribe": "<https://itnyang.test/u?t=1>",
			"X-Evil":           "a\r\nBcc: victim@x.y",
		},
	}))

	if !strings.Contains(msg, "Subject: =?utf-8?b?") {
		t.Errorf("subject is not RFC 2047 encoded:\n%s", msg)
	}
	if !strings.Contains(msg, "List-Unsubscribe: <https://itnyang.test/u?t=1>\r\n") {
		t.Errorf("extra header missing:\n%s", msg)
	}
	if strings.Contains(msg, "Bcc:") {
		t.Errorf("header injection got through:\n%s", msg)
	}
	if !strings.HasSuffix(msg, "\r\n\r\n본문") {
		t.Errorf("body not separated from headers:\n%q", msg)
	}
}
