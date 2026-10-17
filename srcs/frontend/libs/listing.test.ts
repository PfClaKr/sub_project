import { describe, expect, it } from "vitest";
import { expiryInfo, listingHref, listingVariables, moveInLabel, parseListingParams, rentLabel, wageLabel, warningText } from "./listing";

const parse = (type: "housing" | "job", s: string) => parseListingParams(type, new URLSearchParams(s));

describe("listing params", () => {
	it("keeps only values valid for the board", () => {
		expect(parse("housing", "mode=offer&kind=쉐어&max=700&by=2026-09-01&caf=1&furnished=0&sort=rent_asc&page=2")).toEqual({
			mode: "offer", kind: "쉐어", max: 700, by: "2026-09-01", caf: true, sort: "rent_asc", page: 2,
		});
		expect(parse("housing", "mode=hiring&sort=wage_desc&max=-5&by=soon")).toEqual({});
		expect(parse("job", "mode=hiring&minwage=12&permitfree=1&sort=wage_desc")).toEqual({
			mode: "hiring", minwage: 12, permitfree: true, sort: "wage_desc",
		});
	});

	it("builds URLs and resets the page", () => {
		const cur = { mode: "offer", page: 3, caf: true };
		expect(listingHref("housing", cur, { max: 800 })).toBe("/housing?mode=offer&caf=1&max=800");
		expect(listingHref("housing", cur, { page: 4 })).toBe("/housing?mode=offer&page=4&caf=1");
		expect(listingHref("job", {}, {})).toBe("/jobs");
	});

	it("turns params into query variables", () => {
		const v = listingVariables("housing", { kind: "쉐어", area: "R9520" }, "파리");
		expect(v).toMatchObject({ type: "housing", city: "파리", area: "R9520", km: null });
		expect(v.housing).toMatchObject({ Kinds: ["쉐어"], Caf: false });
		const near = listingVariables("job", { lat: 48.8, lng: 2.3, km: 5, area: "R1" }, "");
		expect(near).toMatchObject({ area: null, lat: 48.8, km: 5, city: null });
	});
});

describe("labels", () => {
	it("formats rent and wage", () => {
		expect(rentLabel({ Mode: "offer", Kind: "쉐어", Rent: 750, ChargesIncluded: true, AvailableFrom: "" })).toBe("€750/월 · 관리비 포함");
		expect(rentLabel({ Mode: "seek", Kind: "쉐어", Rent: 600, AvailableFrom: "" })).toBe("최대 €600/월");
		expect(wageLabel({ Mode: "hiring", Sector: "", Employment: "", WageType: "hourly", Wage: 12.5 })).toBe("시급 €12.5");
		expect(wageLabel({ Mode: "hiring", Sector: "", Employment: "", WageType: "negotiable" })).toBe("급여 협의");
	});

	it("describes the move-in date", () => {
		const today = new Date(2026, 9, 17);
		expect(moveInLabel("2026-10-01", today)).toBe("바로 입주");
		expect(moveInLabel("2026-11-01", today)).toBe("11월 1일부터");
		expect(moveInLabel("2027-01-15", today)).toBe("2027년 1월 15일부터");
	});

	it("knows when a listing can be extended", () => {
		const now = Date.UTC(2026, 9, 17);
		expect(expiryInfo({ ExpiresAt: now + 20 * 86_400_000, Status: "active" }, now)).toEqual({ expired: false, daysLeft: 20, extendable: false });
		expect(expiryInfo({ ExpiresAt: now + 3 * 86_400_000, Status: "active" }, now)).toMatchObject({ extendable: true, daysLeft: 3 });
		expect(expiryInfo({ ExpiresAt: now - 1, Status: "expired" }, now)).toMatchObject({ expired: true, extendable: true });
	});

	it("explains every warning code", () => {
		for (const code of ["contact", "prepay", "low_wage"]) expect(warningText(code).title).not.toBe("확인이 필요한 내용이 있어요");
	});
});
