import type { Room, SubjectType } from "@/libs/types";

// Chat rooms are about a product or a housing/job post; these keep the
// per-kind wording and links in one place.
const KINDS: Record<SubjectType, { path: string; mine: string; missing: string }> = {
	product: { path: "/product", mine: "내 상품", missing: "삭제된 상품" },
	housing: { path: "/housing", mine: "내 집 글", missing: "삭제된 글" },
	job: { path: "/jobs", mine: "내 알바 글", missing: "삭제된 글" },
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

export function subjectTitle(room: Pick<Room, "SubjectType" | "SubjectId" | "ProductId" | "SubjectTitle" | "ProductName">): string {
	const { type } = subjectOf(room);
	return room.SubjectTitle || room.ProductName || KINDS[type].missing;
}

export function mineLabel(type: SubjectType): string {
	return KINDS[type].mine;
}
