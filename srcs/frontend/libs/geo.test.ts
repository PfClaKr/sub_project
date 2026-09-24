import { describe, expect, it } from "vitest";
import { areaLabel, distanceLabel, SEARCH_DISTANCES } from "./geo";

describe("geo labels", () => {
	it("labels distances like leboncoin's radius", () => {
		expect(distanceLabel(0)).toBe("이 지역만");
		expect(distanceLabel(10)).toBe("+10km");
		expect(SEARCH_DISTANCES[0]).toBe(0);
	});

	it("adds the postcode when known", () => {
		expect(areaLabel({ Name: "Paris 15e", Postcode: "75015" })).toBe("Paris 15e (75015)");
		expect(areaLabel({ Name: "Puteaux", Postcode: "" })).toBe("Puteaux");
	});
});
