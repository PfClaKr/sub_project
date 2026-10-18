import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatPrice, formatRelative, formatTime, imageUrl, thumbUrl, toMs } from "./format";

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

describe("thumbUrl", () => {
	const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
	it("points uploaded photos at their thumbnail", () => {
		expect(thumbUrl(`https://b.s3.eu-west-3.amazonaws.com/${id}.jpg`)).toBe(`https://b.s3.eu-west-3.amazonaws.com/${id}_t.jpg`);
		expect(thumbUrl(`https://x/media/product-images/${id}.webp`)).toBe(`https://x/media/product-images/${id}_t.jpg`);
		expect(thumbUrl(`https://x/${id}.png`)).toBe(`https://x/${id}_t.png`);
		expect(thumbUrl(`https://x/${id}.GIF`)).toBe(`https://x/${id}_t.png`);
	});
	it("leaves other images alone", () => {
		expect(thumbUrl("https://lh3.googleusercontent.com/a/photo.jpg")).toBeNull();
		expect(thumbUrl(`https://x/${id}_t.jpg`)).toBeNull();
		expect(thumbUrl("default_profile_image.png")).toBeNull();
		expect(thumbUrl(null)).toBeNull();
	});
});

describe("time formats", () => {
	it("use a 24-hour clock so server and browser render the same text", () => {
		const ts = Date.UTC(2026, 9, 17, 15, 4); // 17:04 in Paris (CEST)
		expect(formatTime(ts)).toBe("17:04");
		expect(formatDateTime(ts)).toContain("17:04");
		expect(formatDateTime(ts)).not.toMatch(/AM|PM|오전|오후/);
	});
});

describe("other languages", () => {
	const now = Date.UTC(2026, 8, 23, 12, 0, 0);
	const ago = (s: number) => (now - s * 1000) / 1000;
	it("format relative times", () => {
		expect(formatRelative(ago(5 * 60), now, "fr")).toBe("il y a 5 minutes");
		expect(formatRelative(ago(3 * 3600), now, "en")).toBe("3 hours ago");
		expect(formatRelative(ago(10), now, "fr")).toBe("à l'instant");
	});
	it("format prices the local way", () => {
		expect(formatPrice(1250, "fr")).toMatch(/^1\s?250\s?€$/);
		expect(formatPrice(1250, "en")).toBe("€1,250");
	});
	it("format dates", () => {
		const ts = Date.UTC(2026, 9, 17, 15, 4);
		expect(formatDate(ts, "fr")).toBe("17 octobre 2026");
		expect(formatDate(ts, "en")).toBe("17 October 2026");
		expect(formatTime(ts, "en")).toBe("17:04");
	});
});
