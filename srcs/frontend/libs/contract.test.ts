import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATEGORIES, REGIONS, STATUSES, STATUS_SELLING } from "./constants";

// Values the frontend and the apiserver must agree on. Reading the Go
// source keeps them from drifting apart silently.
const goSource = readFileSync(
	fileURLToPath(new URL("../../server/apiserver/graphqlhandler/graphqlResolve.go", import.meta.url)),
	"utf8",
);

function goStrings(pattern: RegExp): string[] {
	const block = goSource.match(pattern)?.[1] ?? "";
	return Array.from(block.matchAll(/"([^"]+)"/g), m => m[1]);
}

describe("frontend ↔ apiserver contract", () => {
	it("uses the same categories, in the same order", () => {
		expect(goStrings(/var Categories = \[\]string\{([^}]*)\}/)).toEqual([...CATEGORIES]);
	});

	it("uses the same regions, in the same order", () => {
		expect(goStrings(/var Regions = \[\]string\{([^}]*)\}/)).toEqual([...REGIONS]);
	});

	it("uses the same product statuses", () => {
		const statuses = goStrings(/var validStatuses = map\[string\]bool\{([^}]*)\}/)
			.concat(goSource.includes(`StatusSelling: true`) ? [STATUS_SELLING] : []);
		expect(new Set(statuses)).toEqual(new Set(STATUSES));
		expect(goSource).toContain(`const StatusSelling = "${STATUS_SELLING}"`);
	});
});
