package eshandler

import (
	"strings"
	"unicode"
)

// Elasticsearch has no jamo analysis without third-party plugins, so
// jamo and chosung forms are computed here, both when indexing and when
// querying, and stored as plain whitespace-separated fields.

const (
	syllableBase = 0xAC00
	syllableLast = 0xD7A3
)

var (
	choseong  = []rune("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
	jungseong = []string{"ㅏ", "ㅐ", "ㅑ", "ㅒ", "ㅓ", "ㅔ", "ㅕ", "ㅖ", "ㅗ", "ㅗㅏ", "ㅗㅐ", "ㅗㅣ", "ㅛ", "ㅜ", "ㅜㅓ", "ㅜㅔ", "ㅜㅣ", "ㅠ", "ㅡ", "ㅡㅣ", "ㅣ"}
	jongseong = []string{"", "ㄱ", "ㄲ", "ㄱㅅ", "ㄴ", "ㄴㅈ", "ㄴㅎ", "ㄷ", "ㄹ", "ㄹㄱ", "ㄹㅁ", "ㄹㅂ", "ㄹㅅ", "ㄹㅌ", "ㄹㅍ", "ㄹㅎ", "ㅁ", "ㅂ", "ㅂㅅ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"}
)

// Compound compatibility jamo typed on their own, split the same way.
var compoundJamo = map[rune]string{
	'ㄳ': "ㄱㅅ", 'ㄵ': "ㄴㅈ", 'ㄶ': "ㄴㅎ", 'ㄺ': "ㄹㄱ", 'ㄻ': "ㄹㅁ", 'ㄼ': "ㄹㅂ",
	'ㄽ': "ㄹㅅ", 'ㄾ': "ㄹㅌ", 'ㄿ': "ㄹㅍ", 'ㅀ': "ㄹㅎ", 'ㅄ': "ㅂㅅ",
	'ㅘ': "ㅗㅏ", 'ㅙ': "ㅗㅐ", 'ㅚ': "ㅗㅣ", 'ㅝ': "ㅜㅓ", 'ㅞ': "ㅜㅔ", 'ㅟ': "ㅜㅣ", 'ㅢ': "ㅡㅣ",
}

func isSyllable(r rune) bool { return r >= syllableBase && r <= syllableLast }

// isJamo reports Hangul compatibility jamo (what an IME shows mid-typing).
func isJamo(r rune) bool { return r >= 0x3131 && r <= 0x318E }

func isConsonantJamo(r rune) bool { return r >= 0x3131 && r <= 0x314E }

func isHangul(r rune) bool { return isSyllable(r) || isJamo(r) }

// Jamo decomposes Hangul into keystroke order, so any prefix of what a
// user types (e.g. "아잎" on the way to "아이폰") is a prefix of the
// decomposition of the finished word. Other characters are lowercased.
func Jamo(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case isSyllable(r):
			i := int(r - syllableBase)
			b.WriteRune(choseong[i/588])
			b.WriteString(jungseong[(i%588)/28])
			b.WriteString(jongseong[i%28])
		case compoundJamo[r] != "":
			b.WriteString(compoundJamo[r])
		default:
			b.WriteRune(unicode.ToLower(r))
		}
	}
	return b.String()
}

// Chosung returns the initial consonants of a Hangul word ("아이폰" →
// "ㅇㅇㅍ"); consonant jamo pass through, anything else is dropped.
func Chosung(s string) string {
	var b strings.Builder
	for _, r := range s {
		switch {
		case isSyllable(r):
			b.WriteRune(choseong[(r-syllableBase)/588])
		case isConsonantJamo(r):
			b.WriteRune(r)
		}
	}
	return b.String()
}

// IsChosungQuery reports queries made only of consonants, like "ㅇㅇㅍ".
func IsChosungQuery(s string) bool {
	found := false
	for _, r := range s {
		switch {
		case isConsonantJamo(r):
			found = true
		case unicode.IsSpace(r):
		default:
			return false
		}
	}
	return found
}

// Words splits text into lowercase words, also breaking between Hangul
// and Latin/digits so "아이폰12" matches "아이폰 12".
func Words(s string) []string {
	var words []string
	var cur []rune
	curHangul := false
	flush := func() {
		if len(cur) > 0 {
			words = append(words, strings.ToLower(string(cur)))
			cur = cur[:0]
		}
	}
	for _, r := range s {
		if !unicode.IsLetter(r) && !unicode.IsDigit(r) && !isJamo(r) {
			flush()
			continue
		}
		h := isHangul(r)
		if len(cur) > 0 && h != curHangul {
			flush()
		}
		curHangul = h
		cur = append(cur, r)
	}
	flush()
	return words
}

// JamoWords is the indexed/queried form of NameWords.
func JamoWords(s string) string {
	words := Words(s)
	for i, w := range words {
		words[i] = Jamo(w)
	}
	return strings.Join(words, " ")
}

// ChosungWords is the indexed form of NameChosung (Hangul words only).
func ChosungWords(s string) string {
	var out []string
	for _, w := range Words(s) {
		if c := Chosung(w); c != "" {
			out = append(out, c)
		}
	}
	return strings.Join(out, " ")
}
