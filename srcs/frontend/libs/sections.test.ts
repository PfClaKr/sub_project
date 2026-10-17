import { describe, expect, it } from "vitest";
import { HOME, SECTIONS, isActive } from "./sections";

const byLabel = (label: string) => SECTIONS.find(s => s.label === label)!;

describe("sections", () => {
	it("marks the market tab on product and sell pages", () => {
		expect(isActive(byLabel("중고"), "/product/p1")).toBe(true);
		expect(isActive(byLabel("중고"), "/sell")).toBe(true);
		expect(isActive(byLabel("중고"), "/community")).toBe(false);
	});

	it("matches whole path segments only", () => {
		expect(isActive(byLabel("알바"), "/jobs/j1")).toBe(true);
		expect(isActive(byLabel("알바"), "/jobsearch")).toBe(false);
	});

	it("marks home only on /", () => {
		expect(isActive(HOME, "/")).toBe(true);
		expect(isActive(HOME, "/search")).toBe(false);
	});
});
