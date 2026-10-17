import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LEGAL_VERSION } from "./legal";
import {
	CATEGORIES, EMPLOYMENT_TYPES, FREE_TOPICS, HOUSING_KINDS, JOB_LANGUAGES, JOB_SECTORS, QNA_TOPICS, REGIONS, REPORT_REASONS, STATUSES, STATUS_SELLING,
} from "./constants";

// Values the frontend and the apiserver must agree on. Reading the Go
// source keeps them from drifting apart silently.
const readGo = (file: string) =>
	readFileSync(fileURLToPath(new URL(`../../server/apiserver/graphqlhandler/${file}`, import.meta.url)), "utf8");
const goSource = readGo("graphqlResolve.go");
const communitySource = readGo("community.go");
const reportSource = readGo("reports.go");
const listingSource = readGo("listings.go");

function goStrings(pattern: RegExp, source = goSource): string[] {
	const block = source.match(pattern)?.[1] ?? "";
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

	it("uses the same community topics", () => {
		expect(goStrings(/var FreeTopics = \[\]string\{([^}]*)\}/, communitySource)).toEqual([...FREE_TOPICS]);
		expect(goStrings(/var QnaTopics = \[\]string\{([^}]*)\}/, communitySource)).toEqual([...QNA_TOPICS]);
	});

	it("uses the same report reasons", () => {
		expect(goStrings(/var ReportReasons = \[\]string\{([^}]*)\}/, reportSource)).toEqual([...REPORT_REASONS]);
	});

	it("uses the same housing and job values", () => {
		const list = (name: string) => goStrings(new RegExp(`var ${name} = \\[\\]string\\{([^}]*)\\}`), listingSource);
		expect(list("HousingKinds")).toEqual([...HOUSING_KINDS]);
		expect(list("JobSectors")).toEqual([...JOB_SECTORS]);
		expect(list("EmploymentTypes")).toEqual([...EMPLOYMENT_TYPES]);
		expect(list("JobLanguages")).toEqual([...JOB_LANGUAGES]);
	});

	it("stores the terms version the legal pages show", () => {
		const signup = readFileSync(fileURLToPath(new URL("../../server/loginserver/signuphandler/signuphandler.go", import.meta.url)), "utf8");
		expect(signup.match(/const TermsVersion = "([^"]+)"/)?.[1]).toBe(LEGAL_VERSION);
	});
});
