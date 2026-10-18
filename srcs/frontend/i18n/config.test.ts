import { describe, expect, it } from "vitest";
import { pickLocale } from "./config";

describe("pickLocale", () => {
	it("prefers Korean whenever the browser lists it", () => {
		expect(pickLocale("fr-FR,fr;q=0.9,ko;q=0.8,en;q=0.7")).toBe("ko");
		expect(pickLocale("ko-KR")).toBe("ko");
	});
	it("otherwise takes the best supported language", () => {
		expect(pickLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
		expect(pickLocale("de-DE,en;q=0.5,fr;q=0.4")).toBe("en");
		expect(pickLocale("en;q=0.3,fr;q=0.9")).toBe("fr");
	});
	it("falls back to Korean", () => {
		expect(pickLocale("")).toBe("ko");
		expect(pickLocale(null)).toBe("ko");
		expect(pickLocale("de,ja")).toBe("ko");
		expect(pickLocale("fr;q=0")).toBe("ko");
	});
});
