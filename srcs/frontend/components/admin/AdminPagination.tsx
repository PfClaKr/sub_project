'use client';

import { Pagination, LinkButton } from "@/styles/styledUi";
import { buildAdminHref, type SearchParams } from "@/libs/adminParams";
import { useTranslations } from "next-intl";

export function AdminPagination({ pathname, params, page, totalPages, total }: {
	pathname: string;
	params: SearchParams;
	page: number;
	totalPages: number;
	total: number;
}) {
	const t = useTranslations("admin");
	const c = useTranslations("common");
	return (
		<Pagination aria-label={t("pages")}>
			{page > 1 && <LinkButton $ghost href={buildAdminHref(pathname, params, { page: String(page - 1) })}>{c("prev")}</LinkButton>}
			<span>{t("pageInfo", { page, total: totalPages, count: total })}</span>
			{page < totalPages && <LinkButton $ghost href={buildAdminHref(pathname, params, { page: String(page + 1) })}>{c("next")}</LinkButton>}
		</Pagination>
	);
}
