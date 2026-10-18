import { getLocale, getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import type { Locale } from "@/i18n/config";
import Link from "next/link";
import { AdminListFilters } from "@/components/admin/AdminListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { PostStatusControl } from "@/components/admin/Controls";
import { adminGet, isAdmin, type AdminPage } from "@/libs/adminApi";
import { apiQuery, param, type SearchParams } from "@/libs/adminParams";
import { postHref } from "@/libs/community";
import { formatDate } from "@/libs/format";
import { getLabels } from "@/libs/labels.server";
import { EmptyRow, Panel, RoleBadge, Table, TableWrap } from "@/styles/styledAdmin";
import type { Post } from "@/libs/types";

export const generateMetadata = pageMetadata("admin.posts");

type AdminPost = {
	PostId: string; Type: Post["Type"]; Topic: string; Title: string; Status: string; Deal: string;
	AuthorId: string; AuthorNickname: string; AuthorEmail: string; Anonymous: boolean;
	Flags: string[]; ReportCount: number; CommentCount: number; CreatedAt: number;
};

// Every board in one list. Anonymous posts show their real author here,
// for acting on reports; the "익명" badge marks them.
export default async function AdminPostsPage({ searchParams }: { searchParams: SearchParams }) {
	if (!(await isAdmin())) return null;
	const L = await getLabels();
	const t = await getTranslations("admin");
	const locale = (await getLocale()) as Locale;
	const list = await adminGet<AdminPage<AdminPost>>(`/posts${apiQuery(searchParams, ["q", "type", "status", "flagged", "page"])}`);

	return (
		<Panel>
			<h2>{t("posts.title")}</h2>
			<AdminListFilters
				search={param(searchParams, "q")}
				placeholder={t("posts.placeholder")}
				selects={[
					{
						name: "type", label: t("posts.board"), value: param(searchParams, "type"),
						options: [{ value: "", label: t("all") }, ...(["qna", "free", "housing", "job"] as const).map(b => ({ value: b, label: L.board(b) }))],
					},
					{
						name: "status", label: t("posts.status"), value: param(searchParams, "status"),
						options: [{ value: "", label: t("all") }, ...(["active", "hidden", "expired", "deleted"] as const).map(s => ({ value: s, label: t(`posts.${s}`) }))],
					},
					{
						name: "flagged", label: t("posts.flags"), value: param(searchParams, "flagged"),
						options: [{ value: "", label: t("all") }, { value: "1", label: t("posts.flaggedOnly") }],
					},
				]}
			/>
			<TableWrap>
				<Table>
					<thead>
						<tr><th>{t("posts.colPost")}</th><th>{t("posts.colAuthor")}</th><th>{t("posts.colFlags")}</th><th>{t("posts.colStatus")}</th><th>{t("posts.colDate")}</th></tr>
					</thead>
					<tbody>
						{list.Items.map(p => (
							<tr key={p.PostId}>
								<td style={{ maxWidth: 380 }}>
									<RoleBadge>{L.board(p.Type)}</RoleBadge> <small>{L.enum(p.Type === "housing" ? "housingKind" : p.Type === "job" ? "jobSector" : "topic", p.Topic)}</small>{p.Deal && <small> · {L.deal(p.Deal)}</small>}
									<div><Link href={postHref(p)} target="_blank">{p.Title}</Link> <small>{t("posts.comments", { count: p.CommentCount })}</small></div>
								</td>
								<td data-label={t("posts.colAuthor")}>
									{p.AuthorNickname
										? <Link href={`/admin/users?q=${encodeURIComponent(p.AuthorEmail || p.AuthorNickname)}`}>{p.AuthorNickname}</Link>
										: t("left")}
									{p.Anonymous && <> <RoleBadge>{t("posts.anonymous")}</RoleBadge></>}
								</td>
								<td data-label={t("posts.colFlags")}>
									{p.Flags.map(f => <div key={f}><small>⚠ {L.warning(f).title}</small></div>)}
									{p.ReportCount > 0 && <Link href="/admin/reports?type=post"><small>{t("posts.reports", { count: p.ReportCount })}</small></Link>}
									{p.Flags.length === 0 && !p.ReportCount && "—"}
								</td>
								<td data-label={t("posts.colStatus")}><PostStatusControl postId={p.PostId} status={p.Status} /></td>
								<td data-label={t("posts.colDate")}>{formatDate(p.CreatedAt, locale)}</td>
							</tr>
						))}
					</tbody>
				</Table>
				{list.Items.length === 0 && <EmptyRow>{t("posts.empty")}</EmptyRow>}
			</TableWrap>
			<AdminPagination pathname="/admin/posts" params={searchParams} page={list.Page} totalPages={list.TotalPages} total={list.Total} />
		</Panel>
	);
}
