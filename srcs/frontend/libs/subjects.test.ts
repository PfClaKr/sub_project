import { describe, expect, it } from "vitest";
import { subjectHref, subjectOf, subjectTitle } from "./subjects";

describe("subjects", () => {
	it("treats rooms without a subject as product rooms", () => {
		expect(subjectOf({ SubjectType: undefined as never, SubjectId: "", ProductId: "p1" })).toEqual({ type: "product", id: "p1" });
		expect(subjectHref({ SubjectType: undefined as never, SubjectId: "", ProductId: "p1" })).toBe("/product/p1");
	});

	it("links each kind to its own page", () => {
		expect(subjectHref({ SubjectType: "housing", SubjectId: "h 1" })).toBe("/housing/h%201");
		expect(subjectHref({ SubjectType: "job", SubjectId: "j1" })).toBe("/jobs/j1");
	});

	it("falls back to the product name, then to a deleted label", () => {
		expect(subjectTitle({ SubjectType: "product", SubjectId: "p", ProductName: "의자" })).toBe("의자");
		expect(subjectTitle({ SubjectType: "housing", SubjectId: "h" })).toBe("삭제된 글");
	});
});
