import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { ListingType } from "@/libs/constants";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { formatPrice } from "@/libs/format";
import type { HousingInfo, JobInfo, Post } from "@/libs/types";

// A translator over the whole catalog: useTranslations() in components,
// getTranslations() on the server, createTranslator() in tests.
export type T = {
	(key: string, values?: Record<string, string | number | Date>): string;
	has(key: string): boolean;
};

// Stored values (categories, regions, topics, ...) are Korean words shared
// with the Go server; messages map each one to a display name per
// language under enums.<group>.<value>. Unknown values show as stored.
export type EnumGroup =
	| "category" | "region" | "status" | "topic" | "reportReason"
	| "housingKind" | "jobSector" | "employment" | "jobLanguage";

export function makeLabels(t: T, locale: Locale = DEFAULT_LOCALE) {
	const known = (key: string, fallback = "") => (t.has(key) ? t(key) : fallback);
	const price = (n: number | undefined) => formatPrice(n, locale);
	return {
		enum: (group: EnumGroup, value: string | undefined) => (value ? known(`enums.${group}.${value}`, value) : ""),
		board: (type: Post["Type"]) => known(`enums.board.${type}`, type),
		mode: (type: ListingType, mode?: string) => (mode ? known(`enums.mode.${type}.${mode}`) : ""),
		deal: (deal?: string) => (deal ? known(`enums.deal.${deal}`) : ""),
		// "€750/월 · 관리비 포함" (or "최대 €750/월" for someone looking).
		rent: (h: HousingInfo) => {
			const base = t(h.Mode === "seek" ? "listing.labels.rentMax" : "listing.labels.rent", { price: price(h.Rent) });
			return h.ChargesIncluded ? t("listing.labels.charges", { base }) : base;
		},
		wage: (j: JobInfo) => {
			if (j.WageType === "negotiable" || !j.Wage) return t("listing.labels.negotiable");
			return t(j.WageType === "hourly" ? "listing.labels.hourly" : "listing.labels.monthly", { price: price(j.Wage) });
		},
		// "9월 1일부터" from YYYY-MM-DD, "바로 입주" when it is today or past.
		moveIn: (date: string | undefined, today = new Date()) => {
			if (!date) return "";
			const [y, m, d] = date.split("-").map(Number);
			if (!y || !m || !d) return "";
			const day = Date.UTC(y, m - 1, d);
			if (day <= Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) return t("listing.labels.now");
			const text = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
				timeZone: "UTC", day: "numeric", month: "long", ...(y === today.getFullYear() ? {} : { year: "numeric" }),
			}).format(day);
			return t("listing.labels.from", { date: text });
		},
		// Place filter radius: "이 지역만" for the area itself, else "+5km".
		distance: (km: number) => (km === 0 ? t("listing.labels.thisAreaOnly") : `+${km}km`),
		// Explanations for the warning codes returned by createListing.
		warning: (code: string) => {
			const key = t.has(`listing.warnings.${code}.title`) ? code : "unknown";
			return { title: t(`listing.warnings.${key}.title`), text: t(`listing.warnings.${key}.text`) };
		},
	};
}

export type Labels = ReturnType<typeof makeLabels>;

export function useLabels(): Labels {
	const t = useTranslations() as unknown as T;
	const locale = useLocale() as Locale;
	return useMemo(() => makeLabels(t, locale), [t, locale]);
}
