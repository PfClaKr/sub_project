import { BOARDS, type BoardType } from "@/libs/constants";
import type { Post, PostComment } from "@/libs/types";

const TYPE_LABEL: Record<Post["Type"], string> = { free: BOARDS.free.label, qna: BOARDS.qna.label, housing: "집", job: "알바" };
const TYPE_PATH: Record<Post["Type"], string> = { free: "/community", qna: "/community", housing: "/housing", job: "/jobs" };

export function boardLabel(type: Post["Type"]): string {
	return TYPE_LABEL[type] ?? type;
}

// postHref is the page of any post, community or housing/job.
export function postHref(post: Pick<Post, "PostId" | "Type">): string {
	return `${TYPE_PATH[post.Type] ?? "/community"}/${post.PostId}`;
}

// URL state of the community board (/community?board=qna&topic=...).
export type BoardParams = {
	board?: BoardType;
	topic?: string;
	q?: string;
	solved?: "open" | "solved";
	sort?: "newest" | "popular";
	page?: number;
};

// parseBoardParams keeps only values the board understands, so a stale or
// hand-edited URL cannot send unknown filters to the API.
export function parseBoardParams(sp: { get(name: string): string | null }): BoardParams {
	const board = sp.get("board");
	const out: BoardParams = {};
	if (board === "free" || board === "qna") out.board = board;
	const topic = sp.get("topic");
	if (topic && out.board && BOARDS[out.board].topics.includes(topic)) out.topic = topic;
	const q = sp.get("q")?.trim();
	if (q) out.q = q.slice(0, 100);
	const solved = sp.get("solved");
	if (out.board === "qna" && (solved === "open" || solved === "solved")) out.solved = solved;
	const sort = sp.get("sort");
	if (sort === "newest" || sort === "popular") out.sort = sort;
	const page = Number(sp.get("page"));
	if (Number.isInteger(page) && page > 1) out.page = page;
	return out;
}

// boardHref builds a board URL from the current params plus changes. Any
// change other than the page itself goes back to page 1; changing the
// board drops filters that belong to the old one.
export function boardHref(current: BoardParams, change: Partial<BoardParams>): string {
	const next: BoardParams = { ...current, ...change };
	if (!("page" in change)) delete next.page;
	if ("board" in change && change.board !== current.board) {
		delete next.topic;
		delete next.solved;
	}
	const q = new URLSearchParams();
	for (const key of ["board", "topic", "q", "solved", "sort", "page"] as const) {
		const v = next[key];
		if (v !== undefined && v !== "" && !(key === "page" && v === 1)) q.set(key, String(v));
	}
	const s = q.toString();
	return s ? `/community?${s}` : "/community";
}

export type CommentNode = PostComment & { replies: PostComment[] };

// nestComments groups the flat, time-ordered thread into top-level
// comments with their replies. Replies whose parent is missing are shown
// at the top level rather than lost.
export function nestComments(comments: PostComment[]): CommentNode[] {
	const top: CommentNode[] = [];
	const byId = new Map<string, CommentNode>();
	for (const c of comments) {
		if (!c.ParentId) {
			const node = { ...c, replies: [] };
			byId.set(c.CommentId, node);
			top.push(node);
		}
	}
	for (const c of comments) {
		if (!c.ParentId) continue;
		const parent = byId.get(c.ParentId);
		if (parent) parent.replies.push(c);
		else top.push({ ...c, replies: [] });
	}
	return top;
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

// splitLinks cuts text into plain parts and http(s) links, for rendering
// links in user text without dangerouslySetInnerHTML.
export function splitLinks(text: string): { text: string; href?: string }[] {
	const parts: { text: string; href?: string }[] = [];
	let last = 0;
	for (const m of Array.from(text.matchAll(URL_RE))) {
		const at = m.index ?? 0;
		if (at > last) parts.push({ text: text.slice(last, at) });
		parts.push({ text: m[0], href: m[0] });
		last = at + m[0].length;
	}
	if (last < text.length) parts.push({ text: text.slice(last) });
	return parts;
}
