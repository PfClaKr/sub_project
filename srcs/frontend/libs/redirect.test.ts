import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
	it("keeps same-site paths", () => {
		expect(safeNext("/sell")).toBe("/sell");
		expect(safeNext("/search/%EC%B1%85?sort=newest")).toBe("/search/%EC%B1%85?sort=newest");
	});

	it.each([undefined, null, "", "sell", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
		"falls back to / for %s",
		next => expect(safeNext(next)).toBe("/"),
	);
});
