import { describe, expect, it } from "vitest";
import { formatPrice, formatRelative, imageUrl, toMs } from "./format";

describe("formatPrice", () => {
	it("formats euros without useless decimals", () => {
		expect(formatPrice(250)).toMatch(/€\s?250$/);
		expect(formatPrice(12.5)).toMatch(/12\.5/);
	});

	it("returns empty text for missing or invalid prices", () => {
		expect(formatPrice(undefined)).toBe("");
		expect(formatPrice("abc")).toBe("");
	});
});

describe("toMs", () => {
	it("treats legacy second timestamps as seconds", () => {
		expect(toMs(1_700_000_000)).toBe(1_700_000_000_000);
		expect(toMs(1_700_000_000_000)).toBe(1_700_000_000_000);
	});
});

describe("formatRelative", () => {
	const now = Date.UTC(2026, 8, 23, 12, 0, 0);
	const ago = (s: number) => (now - s * 1000) / 1000;

	it.each([
		[30, "방금 전"],
		[5 * 60, "5분 전"],
		[3 * 3600, "3시간 전"],
		[2 * 86400, "2일 전"],
	])("%i seconds ago → %s", (seconds, want) => {
		expect(formatRelative(ago(seconds), now)).toBe(want);
	});

	it("falls back to a date after a week", () => {
		expect(formatRelative(ago(10 * 86400), now)).toMatch(/2026/);
	});

	it("never shows future times as negative", () => {
		expect(formatRelative(ago(-60), now)).toBe("방금 전");
	});
});

describe("imageUrl", () => {
	it("keeps http(s) URLs only", () => {
		expect(imageUrl("http://localhost:9000/product-images/a.jpg")).toBe("http://localhost:9000/product-images/a.jpg");
		expect(imageUrl("default_profile_image.png")).toBeNull();
		expect(imageUrl("javascript:alert(1)")).toBeNull();
		expect(imageUrl(undefined)).toBeNull();
	});
});
