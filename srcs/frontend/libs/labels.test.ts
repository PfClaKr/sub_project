import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import ko from "../messages/ko.json";
import fr from "../messages/fr.json";
import en from "../messages/en.json";
import type { Locale } from "@/i18n/config";
import { makeLabels, type T } from "./labels";

const catalogs = { ko, fr, en };
const labels = (locale: Locale) => makeLabels(createTranslator({ locale, messages: catalogs[locale] }) as unknown as T, locale);

describe("labels", () => {
	const L = labels("ko");
	it("formats rent and wage", () => {
		expect(L.rent({ Mode: "offer", Kind: "쉐어", Rent: 750, ChargesIncluded: true, AvailableFrom: "" })).toBe("€750/월 · 관리비 포함");
		expect(L.rent({ Mode: "seek", Kind: "쉐어", Rent: 600, AvailableFrom: "" })).toBe("최대 €600/월");
		expect(L.wage({ Mode: "hiring", Sector: "", Employment: "", WageType: "hourly", Wage: 12.5 })).toBe("시급 €12.5");
		expect(L.wage({ Mode: "hiring", Sector: "", Employment: "", WageType: "negotiable" })).toBe("급여 협의");
	});

	it("describes the move-in date", () => {
		const today = new Date(2026, 9, 17);
		expect(L.moveIn("2026-10-01", today)).toBe("바로 입주");
		expect(L.moveIn("2026-11-01", today)).toBe("11월 1일부터");
		expect(L.moveIn("2027-01-15", today)).toBe("2027년 1월 15일부터");
		expect(labels("fr").moveIn("2026-11-01", today)).toBe("À partir du 1 novembre");
		expect(labels("en").moveIn("2027-01-15", today)).toBe("From 15 January 2027");
	});

	it("explains every warning code", () => {
		for (const code of ["contact", "prepay", "low_wage"]) expect(L.warning(code).title).not.toBe(L.warning("nope").title);
	});

	it("names stored values per language, keeping unknown ones", () => {
		expect(L.enum("topic", "체류증·비자")).toBe("체류증·비자");
		expect(labels("fr").enum("topic", "체류증·비자")).toBe("Titre de séjour et visa");
		expect(labels("en").enum("region", "프랑스 기타")).toBe("Elsewhere in France");
		expect(labels("en").enum("region", "서울")).toBe("서울");
		expect(labels("fr").board("qna")).toBe("Questions pratiques");
		expect(labels("en").mode("job", "hiring")).toBe("Hiring");
		expect(labels("fr").wage({ Mode: "hiring", Sector: "", Employment: "", WageType: "hourly", Wage: 12.5 })).toMatch(/^12,5\s€\/h$/);
	});
});

describe("enum labels", () => {
	it("exist for every value the server accepts", async () => {
		const c = await import("./constants");
		const groups: [string, readonly string[]][] = [
			["category", c.CATEGORIES], ["region", c.REGIONS], ["status", c.STATUSES],
			["topic", [...c.FREE_TOPICS, ...c.QNA_TOPICS]], ["reportReason", c.REPORT_REASONS],
			["housingKind", c.HOUSING_KINDS], ["jobSector", c.JOB_SECTORS], ["employment", c.EMPLOYMENT_TYPES], ["jobLanguage", c.JOB_LANGUAGES],
		];
		const t = createTranslator({ locale: "ko", messages: ko }) as unknown as T;
		for (const [group, values] of groups) for (const v of values) expect(t.has(`enums.${group}.${v}`), `${group}.${v}`).toBe(true);
		for (const type of ["housing", "job"] as const) for (const m of c.LISTING_MODES[type]) expect(t.has(`enums.mode.${type}.${m.value}`)).toBe(true);
		for (const d of c.DEALS) expect(t.has(`enums.deal.${d.value}`)).toBe(true);
	});
});
