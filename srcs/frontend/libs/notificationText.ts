import type { AppNotification, NotificationType } from "@/libs/types";

// Headline per notification type; Preview (the comment text, post title,
// ...) is shown under it.
const TITLES: Record<NotificationType, string> = {
	comment: "내 글에 새 댓글이 달렸어요",
	reply: "내 댓글에 답글이 달렸어요",
	accepted: "내 답변이 채택됐어요",
	expiring: "내 글이 곧 만료돼요",
	hidden: "신고가 쌓여 내 글이 숨겨졌어요",
	restored: "숨겨진 글이 다시 공개됐어요",
	chat: "새 채팅 메시지가 있어요",
	notice: "잇냥 공지",
};

export function notificationTitle(n: Pick<AppNotification, "Type">): string {
	return TITLES[n.Type] ?? "새 알림";
}

// Only site paths are followed; anything else opens the list itself.
export function notificationHref(n: Pick<AppNotification, "Link">): string {
	const link = n.Link ?? "";
	return link.startsWith("/") && !link.startsWith("//") && !link.startsWith("/\\") ? link : "/notifications";
}

// Badge text: large counts are capped so the badge stays small.
export function badgeText(count: number): string {
	if (count <= 0) return "";
	return count > 99 ? "99+" : String(count);
}
