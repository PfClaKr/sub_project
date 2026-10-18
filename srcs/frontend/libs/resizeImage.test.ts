import { describe, expect, it } from "vitest";
import { fitWithin } from "./resizeImage";

describe("fitWithin", () => {
	it("shrinks the long edge to the limit, keeping the ratio", () => {
		expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
		expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
		expect(fitWithin(10000, 10, 1600)).toEqual({ width: 1600, height: 2 });
	});
	it("never enlarges", () => {
		expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
		expect(fitWithin(1600, 900)).toEqual({ width: 1600, height: 900 });
	});
});
