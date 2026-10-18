// Languages of the interface. Korean is the source: every key exists in
// messages/ko.json first, and messages.test.ts checks the others match.
export const LOCALES = ["ko", "fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ko";

// The visitor's choice (LanguageSwitcher). Read on the server so pages
// render in the right language from the first byte.
export const LOCALE_COOKIE = "itnyang.locale";

export const LOCALE_LABELS: Record<Locale, string> = { ko: "한국어", fr: "Français", en: "English" };

export function isLocale(value: unknown): value is Locale {
	return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// pickLocale chooses for a visitor without a saved choice. Most members
// are Koreans whose phones are set to French, so any Korean in the
// Accept-Language list wins; otherwise the first supported language.
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
	const langs = (acceptLanguage ?? "")
		.split(",")
		.map(part => {
			const [tag, ...params] = part.trim().toLowerCase().split(";");
			const q = params.map(p => p.trim()).find(p => p.startsWith("q="));
			return { lang: tag.split("-")[0], q: q ? Number(q.slice(2)) || 0 : 1 };
		})
		.filter(l => l.lang && l.q > 0)
		.sort((a, b) => b.q - a.q)
		.map(l => l.lang);
	if (langs.includes("ko")) return "ko";
	return langs.find(isLocale) ?? DEFAULT_LOCALE;
}
