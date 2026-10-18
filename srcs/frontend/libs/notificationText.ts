import type { AppNotification } from "@/libs/types";
import type { T } from "@/libs/labels";

// Headline per notification type (notifications.types.<type>); Preview
// (the comment text, post title, ...) is shown under it.
export function notificationTitle(t: T, n: Pick<AppNotification, "Type">): string {
	const key = `notifications.types.${n.Type}`;
	return t.has(key) ? t(key) : t("notifications.types.other");
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
