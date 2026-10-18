import type { Room, SubjectType } from "@/libs/types";

// Chat rooms are about a product or a housing/job post; these keep the
// per-kind links in one place (wording: chat.mine.<kind>, chat.missing.<kind>).
const KINDS: Record<SubjectType, { path: string }> = {
	product: { path: "/product" },
	housing: { path: "/housing" },
	job: { path: "/jobs" },
};

// Rooms from older servers have only ProductId.
export function subjectOf(room: Pick<Room, "SubjectType" | "SubjectId" | "ProductId">): { type: SubjectType; id: string } {
	if (room.SubjectType && KINDS[room.SubjectType]) return { type: room.SubjectType, id: room.SubjectId };
	return { type: "product", id: room.ProductId ?? "" };
}

export function subjectHref(room: Pick<Room, "SubjectType" | "SubjectId" | "ProductId">): string {
	const { type, id } = subjectOf(room);
	return `${KINDS[type].path}/${encodeURIComponent(id)}`;
}

// The subject's title, or "" when it was deleted (show chat.missing.<kind>).
export function subjectTitle(room: Pick<Room, "SubjectTitle" | "ProductName">): string {
	return room.SubjectTitle || room.ProductName || "";
}
