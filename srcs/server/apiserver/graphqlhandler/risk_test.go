package graphqlhandler

import (
	"reflect"
	"testing"
)

func TestRiskWarnings(t *testing.T) {
	cases := []struct {
		text string
		want []string
	}{
		{"15구 쉐어 방 있어요. 채팅 주세요.", nil},
		{"카톡 아이디 abc123 로 연락주세요", []string{RiskContact}},
		{"문의는 06 12 34 56 78", []string{RiskContact}},
		{"+33 6 12 34 56 78 로 전화", []string{RiskContact}},
		{"한국 번호 010-1234-5678", []string{RiskContact}},
		{"메일 me@example.com", []string{RiskContact}},
		{"Whatsapp only", []string{RiskContact}},
		{"계약 전에 보증금 먼저 보내주시면 예약해드려요", []string{RiskPrepay}},
		{"웨스턴유니온으로 선입금", []string{RiskPrepay}},
		{"텔레그램으로 연락, 예약금 200유로", []string{RiskContact, RiskPrepay}},
		// Prices and dates must not look like phone numbers.
		{"월세 750유로, 9월 1일 입주, 보증금 1500", nil},
		{"2026-09-01부터 12-31까지", nil},
	}
	for _, c := range cases {
		if got := riskWarnings("", c.text); !reflect.DeepEqual(got, c.want) {
			t.Errorf("riskWarnings(%q) = %v, want %v", c.text, got, c.want)
		}
	}
}
