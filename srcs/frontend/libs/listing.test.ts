import { describe, expect, it } from "vitest";
import { expiryInfo, listingHref, listingVariables, parseListingParams } from "./listing";

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

describe("expiry", () => {
	it("knows when a listing can be extended", () => {
		const now = Date.UTC(2026, 9, 17);
		expect(expiryInfo({ ExpiresAt: now + 20 * 86_400_000, Status: "active" }, now)).toEqual({ expired: false, daysLeft: 20, extendable: false });
		expect(expiryInfo({ ExpiresAt: now + 3 * 86_400_000, Status: "active" }, now)).toMatchObject({ extendable: true, daysLeft: 3 });
		expect(expiryInfo({ ExpiresAt: now - 1, Status: "expired" }, now)).toMatchObject({ expired: true, extendable: true });
	});

});
