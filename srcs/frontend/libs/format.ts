import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

// Every formatter takes the interface language (useLocale() in
// components); the default keeps older callers in Korean. Formatters are
// built once per language.
const INTL_LOCALE: Record<Locale, string> = { ko: "ko-KR", fr: "fr-FR", en: "en-GB" };

function cached<T>(make: (locale: string) => T): (locale: Locale) => T {
	const cache = new Map<Locale, T>();
	return locale => {
		let f = cache.get(locale);
		if (!f) cache.set(locale, (f = make(INTL_LOCALE[locale] ?? INTL_LOCALE[DEFAULT_LOCALE])));
		return f;
	};
}

const priceFormat = cached(l => new Intl.NumberFormat(l, {
	style: "currency",
	currency: "EUR",
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
}));

export function formatPrice(price: number | string | undefined, locale: Locale = DEFAULT_LOCALE): string {
	const n = Number(price);
	return Number.isFinite(n) ? priceFormat(locale).format(n) : "";
}

// Chat timestamps were stored in seconds before switching to ms.
export function toMs(ts: number): number {
	return ts < 1e12 ? ts * 1000 : ts;
}

const dateFormat = cached(l => new Intl.DateTimeFormat(l, {
	timeZone: "Europe/Paris",
	year: "numeric",
	month: "long",
	day: "numeric",
}));

// 24-hour clock: the "오전/오후" text differs between ICU versions (the
// server's Node vs the browser), which breaks hydration.
const timeFormat = cached(l => new Intl.DateTimeFormat(l, {
	timeZone: "Europe/Paris",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
}));

const dateTimeFormat = cached(l => new Intl.DateTimeFormat(l, {
	timeZone: "Europe/Paris",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
}));

export function formatDateTime(ts: number | undefined, locale: Locale = DEFAULT_LOCALE): string {
	return ts ? dateTimeFormat(locale).format(toMs(ts)) : "";
}

export function formatDate(ts: number | undefined, locale: Locale = DEFAULT_LOCALE): string {
	return ts ? dateFormat(locale).format(toMs(ts)) : "";
}

export function formatTime(ts: number, locale: Locale = DEFAULT_LOCALE): string {
	return timeFormat(locale).format(toMs(ts));
}

const relativeFormat = cached(l => new Intl.RelativeTimeFormat(l, { numeric: "always" }));
const JUST_NOW: Record<Locale, string> = { ko: "방금 전", fr: "à l'instant", en: "just now" };

// "3분 전" style for listings; falls back to a date after a week.
export function formatRelative(ts: number | undefined, now = Date.now(), locale: Locale = DEFAULT_LOCALE): string {
	if (!ts) return "";
	const diff = Math.max(0, now - toMs(ts)) / 1000;
	const rel = relativeFormat(locale);
	if (diff < 60) return JUST_NOW[locale];
	if (diff < 3600) return rel.format(-Math.floor(diff / 60), "minute");
	if (diff < 86400) return rel.format(-Math.floor(diff / 3600), "hour");
	if (diff < 7 * 86400) return rel.format(-Math.floor(diff / 86400), "day");
	return formatDate(ts, locale);
}

// Only absolute http(s) URLs are rendered as images; legacy rows hold
// placeholders like "default_profile_image.png".
export function imageUrl(url: string | undefined | null): string | null {
	return url && /^https?:\/\//.test(url) ? url : null;
}
