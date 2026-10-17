package account

import (
	"testing"
	"time"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
)

func TestSuspended(t *testing.T) {
	now := time.UnixMilli(1_000_000)
	cases := []struct {
		name string
		item dynamo.Item
		want bool
	}{
		{"no status (older rows)", dynamo.Item{}, false},
		{"active", dynamo.Item{"Status": {S: aws.String("active")}}, false},
		{"indefinite", dynamo.Item{"Status": {S: aws.String("suspended")}, "SuspendedUntil": {N: aws.String("0")}}, true},
		{"until later", dynamo.Item{"Status": {S: aws.String("suspended")}, "SuspendedUntil": {N: aws.String("1000001")}}, true},
		{"expired", dynamo.Item{"Status": {S: aws.String("suspended")}, "SuspendedUntil": {N: aws.String("999999")}}, false},
	}
	for _, c := range cases {
		if got := StateOf(c.item).Suspended(now); got != c.want {
			t.Errorf("%s: Suspended = %v, want %v", c.name, got, c.want)
		}
	}
}
