const priceFormat = new Intl.NumberFormat("ko-KR", {
	style: "currency",
	currency: "EUR",
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});

export function formatPrice(price: number | string | undefined): string {
	const n = Number(price);
	return Number.isFinite(n) ? priceFormat.format(n) : "";
}

// Chat timestamps were stored in seconds before switching to ms.
export function toMs(ts: number): number {
	return ts < 1e12 ? ts * 1000 : ts;
}

const dateFormat = new Intl.DateTimeFormat("ko-KR", {
	timeZone: "Europe/Paris",
	year: "numeric",
	month: "long",
	day: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("ko-KR", {
	timeZone: "Europe/Paris",
	hour: "2-digit",
	minute: "2-digit",
});

const dateTimeFormat = new Intl.DateTimeFormat("ko-KR", {
	timeZone: "Europe/Paris",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
});

export function formatDateTime(ts: number | undefined): string {
	return ts ? dateTimeFormat.format(toMs(ts)) : "";
}

export function formatDate(ts: number | undefined): string {
	return ts ? dateFormat.format(toMs(ts)) : "";
}

export function formatTime(ts: number): string {
	return timeFormat.format(toMs(ts));
}

// "3분 전" style for listings; falls back to a date after a week.
export function formatRelative(ts: number | undefined, now = Date.now()): string {
	if (!ts) return "";
	const diff = Math.max(0, now - toMs(ts)) / 1000;
	if (diff < 60) return "방금 전";
	if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
	if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
	if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}일 전`;
	return formatDate(ts);
}

// Only absolute http(s) URLs are rendered as images; legacy rows hold
// placeholders like "default_profile_image.png".
export function imageUrl(url: string | undefined | null): string | null {
	return url && /^https?:\/\//.test(url) ? url : null;
}
