package eshandler

import (
	"reflect"
	"strings"
	"testing"
)

func TestJamo(t *testing.T) {
	cases := map[string]string{
		"아이폰":    "ㅇㅏㅇㅣㅍㅗㄴ",
		"과자":     "ㄱㅗㅏㅈㅏ", // compound vowel split into keystrokes
		"닭":      "ㄷㅏㄹㄱ",  // final cluster split
		"iPhone": "iphone",
		"ㅘ":      "ㅗㅏ",
	}
	for in, want := range cases {
		if got := Jamo(in); got != want {
			t.Errorf("Jamo(%q) = %q, want %q", in, got, want)
		}
	}
}

// What an IME shows mid-typing must be a jamo prefix of the final word.
func TestJamoPrefixWhileTyping(t *testing.T) {
	for word, partials := range map[string][]string{
		"아이폰": {"ㅇ", "아", "아ㅇ", "아이", "아잎", "아이포"},
		"닭갈비": {"달", "닭", "닭ㄱ", "닭가", "닭갈"},
		"과자":  {"고", "과", "괒"},
	} {
		full := Jamo(word)
		for _, p := range partials {
			if !strings.HasPrefix(full, Jamo(p)) {
				t.Errorf("Jamo(%q)=%q is not a prefix of Jamo(%q)=%q", p, Jamo(p), word, full)
			}
		}
	}
}

func TestChosung(t *testing.T) {
	if got := ChosungWords("아이폰12 미니 화이트"); got != "ㅇㅇㅍ ㅁㄴ ㅎㅇㅌ" {
		t.Errorf("ChosungWords = %q", got)
	}
	for q, want := range map[string]bool{"ㅇㅇㅍ": true, "ㅊㅅㄱ ㄷㅇㅅ": true, "아이ㅍ": false, "ㅏ": false, "": false, "ab": false} {
		if got := IsChosungQuery(q); got != want {
			t.Errorf("IsChosungQuery(%q) = %v, want %v", q, got, want)
		}
	}
}

func TestWords(t *testing.T) {
	got := Words("아이폰12 미니, 128GB/화이트 (S23)")
	want := []string{"아이폰", "12", "미니", "128gb", "화이트", "s23"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Words = %q, want %q", got, want)
	}
	if got := JamoWords("에어팟 프로"); got != "ㅇㅔㅇㅓㅍㅏㅅ ㅍㅡㄹㅗ" {
		t.Errorf("JamoWords = %q", got)
	}
}
