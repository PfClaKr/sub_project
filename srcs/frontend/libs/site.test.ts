import { describe, expect, it } from "vitest";
import { applyOverrides } from "./site";

describe("applyOverrides", () => {
	const messages = { home: { hero: { lead: "기본", eyebrow: "눈썹" } }, nav: { home: "홈" } };
	it("replaces existing texts only", () => {
		const out = applyOverrides(messages, { "home.hero.lead": "바뀜", "home.nope": "x", "nav.home.deep": "x", "nav.home": "  " });
		expect(out.home.hero.lead).toBe("바뀜");
		expect(out.home.hero.eyebrow).toBe("눈썹");
		expect(out.nav.home).toBe("홈");
		expect(out).not.toHaveProperty("home.nope");
	});
	it("leaves the source untouched", () => {
		applyOverrides(messages, { "home.hero.lead": "바뀜" });
		expect(messages.home.hero.lead).toBe("기본");
	});
});
