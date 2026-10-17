package graphqlhandler

import "regexp"

// Warning codes for housing/job posts. The text is never refused for
// them; the author sees an explanation (libs/listing.ts) and confirms,
// and the post keeps the codes as Flags so moderators look first.
const (
	// Contact details in the text: off-site conversations are where the
	// classic scams happen and leave no trace for a report.
	RiskContact = "contact"
	// Paying before seeing the place or meeting: deposits for a flat
	// never visited, "booking fees", money transfer services.
	RiskPrepay = "prepay"
	// An hourly wage below the legal minimum (job posts).
	RiskLowWage = "low_wage"
)

var (
	messengerRe = regexp.MustCompile(`(?i)카톡|카카오\s*톡|kakao|텔레그램|telegram|왓츠\s*앱|왓츠업|whats\s*app|라인\s*(아이디|id)|line\s*id|위챗|wechat`)
	// French numbers (0X XX XX XX XX, +33 X ...) and Korean mobiles.
	phoneRe  = regexp.MustCompile(`(?:\+|00)33[\s.-]?[1-9](?:[\s.-]?\d{2}){4}|\b0[1-9](?:[\s.-]?\d{2}){4}\b|\b01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}\b`)
	emailRe  = regexp.MustCompile(`[\w.+-]+@[\w-]+\.[\w.-]+`)
	prepayRe = regexp.MustCompile(`(?i)선입금|선금|예약금|먼저\s*(송금|입금|이체)|(송금|입금|이체)\s*(먼저|부터)|보증금\s*(을|를)?\s*먼저|집\s*(보기|보시기)\s*전에?\s*(송금|입금)|western\s*union|웨스턴\s*유니온|money\s*gram|머니\s*그램|해외\s*송금|한국\s*계좌`)
)

// riskWarnings returns the warning codes for a post's title and body.
func riskWarnings(title, body string) []string {
	text := title + "\n" + body
	var out []string
	if messengerRe.MatchString(text) || phoneRe.MatchString(text) || emailRe.MatchString(text) {
		out = append(out, RiskContact)
	}
	if prepayRe.MatchString(text) {
		out = append(out, RiskPrepay)
	}
	return out
}
