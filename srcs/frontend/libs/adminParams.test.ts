import { describe, expect, it } from "vitest";
import { apiQuery, buildAdminHref, param } from "./adminParams";

describe("buildAdminHref", () => {
	const params = { q: "책상", status: "판매중", page: "3" };

	it("keeps other filters and resets the page on a filter change", () => {
		const href = buildAdminHref("/admin/products", params, { status: "예약중" });
		const url = new URL(href, "http://x");
		expect(url.pathname).toBe("/admin/products");
		expect(url.searchParams.get("q")).toBe("책상");
		expect(url.searchParams.get("status")).toBe("예약중");
		expect(url.searchParams.has("page")).toBe(false);
	});

	it("keeps filters when paging", () => {
		const url = new URL(buildAdminHref("/admin/products", params, { page: "4" }), "http://x");
		expect(url.searchParams.get("page")).toBe("4");
		expect(url.searchParams.get("q")).toBe("책상");
	});

	it("drops keys set to null or empty", () => {
		expect(buildAdminHref("/admin/users", { q: "a", role: "admin" }, { q: null, role: "" })).toBe("/admin/users");
	});
});

describe("param / apiQuery", () => {
	it("reads the first value and trims it", () => {
		expect(param({ q: ["  hi ", "x"] }, "q")).toBe("hi");
		expect(param({}, "q")).toBe("");
	});

	it("forwards only allowed keys", () => {
		expect(apiQuery({ q: "a", secret: "x", page: "2" }, ["q", "page"])).toBe("?q=a&page=2");
		expect(apiQuery({}, ["q"])).toBe("");
	});
});
