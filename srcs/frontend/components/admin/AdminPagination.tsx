'use client';

import { Pagination, LinkButton } from "@/styles/styledUi";
import { buildAdminHref, type SearchParams } from "@/libs/adminParams";

export function AdminPagination({ pathname, params, page, totalPages, total }: {
	pathname: string;
	params: SearchParams;
	page: number;
	totalPages: number;
	total: number;
}) {
	return (
		<Pagination aria-label="페이지">
			{page > 1 && <LinkButton $ghost href={buildAdminHref(pathname, params, { page: String(page - 1) })}>← 이전</LinkButton>}
			<span>{page} / {totalPages} 페이지 · 총 {total}건</span>
			{page < totalPages && <LinkButton $ghost href={buildAdminHref(pathname, params, { page: String(page + 1) })}>다음 →</LinkButton>}
		</Pagination>
	);
}
