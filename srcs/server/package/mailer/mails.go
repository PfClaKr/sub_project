package mailer

import "local.com/i18n"

// The account mails, here rather than in loginserver so the admin
// preview (apiserver sitehandler) renders exactly what members get.

// Verification is the sign-up mail with the activation link.
func Verification(lang, link string) (subject string, c Content) {
	return i18n.T(lang, "[잇냥] 이메일 인증을 완료해주세요"), Content{
		Lang:      lang,
		Preheader: i18n.T(lang, "이메일 주소를 인증하면 가입이 끝나요."),
		Heading:   i18n.T(lang, "잇냥에 가입해주셔서 감사합니다!"),
		Intro:     []string{i18n.T(lang, "이메일 주소를 인증하면 가입이 끝나요.")},
		Button:    Link{Label: i18n.T(lang, "이메일 인증하기"), URL: link},
		Notes:     []string{i18n.T(lang, "본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.")},
	}
}

// PasswordReset is the mail with the one-time reset link.
func PasswordReset(lang, link string) (subject string, c Content) {
	return i18n.T(lang, "[잇냥] 비밀번호 재설정"), Content{
		Lang:      lang,
		Preheader: i18n.T(lang, "새 비밀번호를 정해주세요. 링크는 1시간 동안 한 번만 쓸 수 있어요."),
		Heading:   i18n.T(lang, "비밀번호 재설정을 요청하셨어요."),
		Intro:     []string{i18n.T(lang, "새 비밀번호를 정해주세요. 링크는 1시간 동안 한 번만 쓸 수 있어요.")},
		Button:    Link{Label: i18n.T(lang, "새 비밀번호 정하기"), URL: link},
		Notes:     []string{i18n.T(lang, "본인이 요청하지 않았다면 이 메일을 무시하세요. 비밀번호는 바뀌지 않아요.")},
	}
}
