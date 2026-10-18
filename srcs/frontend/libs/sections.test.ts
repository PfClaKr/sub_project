import { describe, expect, it } from "vitest";
import { HOME, SECTIONS, isActive } from "./sections";

const byKey = (key: string) => SECTIONS.find(s => s.key === key)!;

describe("sections", () => {
	it("marks the market tab on product and sell pages", () => {
		expect(isActive(byKey("market"), "/product/p1")).toBe(true);
		expect(isActive(byKey("market"), "/sell")).toBe(true);
		expect(isActive(byKey("market"), "/community")).toBe(false);
	});

	it("matches whole path segments only", () => {
		expect(isActive(byKey("jobs"), "/jobs/j1")).toBe(true);
		expect(isActive(byKey("jobs"), "/jobsearch")).toBe(false);
	});

	it("marks home only on /", () => {
		expect(isActive(HOME, "/")).toBe(true);
		expect(isActive(HOME, "/search")).toBe(false);
	});
});
