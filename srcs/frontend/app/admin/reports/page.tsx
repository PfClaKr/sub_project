import { getLocale, getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import type { Locale } from "@/i18n/config";
import Link from "next/link";
import { AdminListFilters } from "@/components/admin/AdminListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ReportActions } from "@/components/admin/Controls";
import { adminGet, isAdmin, type AdminPage } from "@/libs/adminApi";
import { apiQuery, param, type SearchParams } from "@/libs/adminParams";
import { formatDateTime } from "@/libs/format";
import { getLabels } from "@/libs/labels.server";
import { EmptyRow, Note, Panel, RoleBadge, Table, TableWrap } from "@/styles/styledAdmin";

export const generateMetadata = pageMetadata("admin.reports");

type QueueItem = {
	TargetType: string; TargetId: string; Count: number; Counted: number; Reasons: Record<string, number>;
	Details: string[] | null; LastAt: number; Title: string; Body: string; TargetStatus: string; Link: string;
	OwnerId: string; OwnerNickname: string; OwnerEmail: string; Anonymous: boolean; Flags: string[] | null; Missing: boolean;
};


// A target that is gone (or already deleted) can only be closed.
function actionsFor(item: QueueItem): string[] {
	if (item.Missing) return ["resolve"];
	switch (item.TargetType) {
		case "post":
		case "comment":
			return item.TargetStatus === "deleted" ? ["resolve"] : ["hide", "dismiss", "delete"];
		case "product":
			return ["dismiss", "delete"];
		default:
			// Chats and members: suspend from the member list, then close.
			return ["resolve", "dismiss"];
	}
}

// The queue groups reports by target, most reported first. Suspending
// the owner is done from the member list (linked).
export default async function AdminReportsPage({ searchParams }: { searchParams: SearchParams }) {
	if (!(await isAdmin())) return null;
	const L = await getLabels();
	const t = await getTranslations("admin.reports");
	const a = await getTranslations("admin");
	const locale = (await getLocale()) as Locale;
	const known = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);
	const status = param(searchParams, "status") || "open";
	const list = await adminGet<AdminPage<QueueItem>>(`/reports${apiQuery(searchParams, ["status", "type", "page"])}`);

	return (
		<Panel>
			<h2>{t("title")}</h2>
			<Note>{t("note")}</Note>
			<AdminListFilters
				selects={[
					{
						name: "status", label: t("status"), value: status,
						options: (["open", "resolved", "dismissed"] as const).map(s => ({ value: s, label: t(s) })),
					},
					{
						name: "type", label: t("target"), value: param(searchParams, "type"),
						options: [{ value: "", label: a("all") }, ...(["post", "comment", "product", "user", "chat"] as const).map(k => ({ value: k, label: t(`types.${k}`) }))],
					},
				]}
			/>
			<TableWrap>
				<Table>
					<thead>
						<tr><th>{t("colTarget")}</th><th>{t("colOwner")}</th><th>{t("colReports")}</th><th>{t("colStatus")}</th><th>{t("colLast")}</th>{status === "open" && <th>{t("colAction")}</th>}</tr>
					</thead>
					<tbody>
						{list.Items.map(item => (
							<tr key={`${item.TargetType}:${item.TargetId}`}>
								<td style={{ maxWidth: 360 }}>
									<RoleBadge>{known(`types.${item.TargetType}`, item.TargetType)}</RoleBadge>{" "}
									{item.Missing ? <em>{t("gone")}</em> : <Link href={item.Link} target="_blank">{item.TargetType === "comment" ? (item.Title ? t("commentOn", { title: item.Title }) : t("comment")) : item.Title || a("noTitle")}</Link>}
									{item.Body && <div><small>{item.Body}</small></div>}
									{item.Flags?.map(f => <div key={f}><small>⚠ {L.warning(f).title}</small></div>)}
								</td>
								<td data-label={t("colOwner")}>
									{item.OwnerId
										? <Link href={`/admin/users?q=${encodeURIComponent(item.OwnerEmail || item.OwnerNickname)}`}>{item.OwnerNickname || a("left")}</Link>
										: "—"}
									{item.Anonymous && <div><small>{t("anonymous")}</small></div>}
								</td>
								<td data-label={t("colReports")}>
									<strong>{t("count", { count: item.Count })}</strong> <small>{t("counted", { count: item.Counted })}</small>
									{Object.entries(item.Reasons).map(([r, n]) => <div key={r}><small>{L.enum("reportReason", r)} {n}</small></div>)}
									{item.Details?.map((d, i) => <div key={i}><small>“{d}”</small></div>)}
								</td>
								<td data-label={t("colStatus")}>{item.TargetStatus ? known(`targetStatus.${item.TargetStatus}`, item.TargetStatus) : "—"}</td>
								<td data-label={t("colLast")}>{formatDateTime(item.LastAt, locale)}</td>
								{status === "open" && <td><ReportActions targetType={item.TargetType} targetId={item.TargetId} actions={actionsFor(item)} /></td>}
							</tr>
						))}
					</tbody>
				</Table>
				{list.Items.length === 0 && <EmptyRow>{status === "open" ? t("emptyOpen") : t("empty")}</EmptyRow>}
			</TableWrap>
			<AdminPagination pathname="/admin/reports" params={searchParams} page={list.Page} totalPages={list.TotalPages} total={list.Total} />
		</Panel>
	);
}
