package notify

import "local.com/i18n"

// Titles are the headlines used in emails and push messages, in Korean;
// TitleIn gives them in a member's language (package i18n). The site has
// the same texts in its messages (notifications.types).
var Titles = map[string]string{
	TypeComment:  "내 글에 새 댓글이 달렸어요",
	TypeReply:    "내 댓글에 답글이 달렸어요",
	TypeAccepted: "내 답변이 채택됐어요",
	TypeExpiring: "내 글이 곧 만료돼요",
	TypeHidden:   "신고가 쌓여 내 글이 숨겨졌어요",
	TypeRestored: "숨겨진 글이 다시 공개됐어요",
	TypeChat:     "새 채팅 메시지가 있어요",
	TypeNotice:   "잇냥 공지",
}

func Title(typ string) string {
	if t, ok := Titles[typ]; ok {
		return t
	}
	return "새 알림"
}

// TitleIn is Title in lang.
func TitleIn(lang, typ string) string {
	return i18n.T(lang, Title(typ))
}

// SettingLabels name each type on the settings screen.
var SettingLabels = map[string]string{
	TypeComment:  "내 글의 댓글",
	TypeReply:    "내 댓글의 답글",
	TypeAccepted: "답변 채택",
	TypeExpiring: "집·알바 글 만료 예정",
	TypeChat:     "채팅 메시지",
	TypeHidden:   "신고로 숨김",
	TypeRestored: "숨김 해제",
	TypeNotice:   "잇냥 공지",
}
