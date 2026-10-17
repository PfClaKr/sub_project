import { describe, expect, it } from "vitest";
import { boardHref, nestComments, parseBoardParams, splitLinks } from "./community";

const params = (s: string) => parseBoardParams(new URLSearchParams(s));

describe("board params", () => {
	it("keeps only known values", () => {
		expect(params("board=qna&topic=의료&solved=open&sort=popular&page=3&q=  CAF  ")).toEqual({
			board: "qna", topic: "의료", solved: "open", sort: "popular", page: 3, q: "CAF",
		});
		expect(params("board=housing&topic=의료&solved=open&page=-2&sort=random")).toEqual({});
		// A topic of another board, and the solved filter outside Q&A, are dropped.
		expect(params("board=free&topic=의료&solved=open")).toEqual({ board: "free" });
	});

	it("resets the page and the old board's filters", () => {
		const cur = { board: "qna" as const, topic: "의료", solved: "open" as const, page: 4 };
		expect(boardHref(cur, { page: 5 })).toBe("/community?board=qna&topic=%EC%9D%98%EB%A3%8C&solved=open&page=5");
		expect(boardHref(cur, { sort: "popular" })).toBe("/community?board=qna&topic=%EC%9D%98%EB%A3%8C&solved=open&sort=popular");
		expect(boardHref(cur, { board: "free" })).toBe("/community?board=free");
		expect(boardHref({}, {})).toBe("/community");
	});
});

describe("nestComments", () => {
	it("groups replies under their parent and keeps orphans", () => {
		const c = (id: string, parent?: string) => ({ CommentId: id, ParentId: parent, Body: id, DisplayName: "", CreatedAt: 0 });
		const nested = nestComments([c("a"), c("b"), c("a1", "a"), c("x1", "gone"), c("a2", "a")]);
		expect(nested.map(n => n.CommentId)).toEqual(["a", "b", "x1"]);
		expect(nested[0].replies.map(r => r.CommentId)).toEqual(["a1", "a2"]);
	});
});

describe("splitLinks", () => {
	it("finds http links and leaves trailing punctuation out", () => {
		expect(splitLinks("예약은 https://rdv.example.fr/a?b=1. 에서")).toEqual([
			{ text: "예약은 " },
			{ text: "https://rdv.example.fr/a?b=1", href: "https://rdv.example.fr/a?b=1" },
			{ text: ". 에서" },
		]);
		expect(splitLinks("javascript:alert(1) 없음")).toEqual([{ text: "javascript:alert(1) 없음" }]);
	});
});
