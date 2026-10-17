import { Metadata } from "next";
import Link from "next/link";
import { AdminListFilters } from "@/components/admin/AdminListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ReportActions } from "@/components/admin/Controls";
import { adminGet, isAdmin, type AdminPage } from "@/libs/adminApi";
import { apiQuery, param, type SearchParams } from "@/libs/adminParams";
import { formatDateTime } from "@/libs/format";
import { warningText } from "@/libs/listing";
import { EmptyRow, Note, Panel, RoleBadge, Table, TableWrap } from "@/styles/styledAdmin";

export const metadata: Metadata = { title: "신고" };

type QueueItem = {
	TargetType: string; TargetId: string; Count: number; Counted: number; Reasons: Record<string, number>;
	Details: string[] | null; LastAt: number; Title: string; Body: string; TargetStatus: string; Link: string;
	OwnerId: string; OwnerNickname: string; OwnerEmail: string; Anonymous: boolean; Flags: string[] | null; Missing: boolean;
};

const TYPE_LABEL: Record<string, string> = { post: "글", comment: "댓글", product: "상품", user: "회원" };
const STATUS_LABEL: Record<string, string> = { active: "공개", hidden: "숨김", deleted: "삭제됨", expired: "만료" };

function actionsFor(item: QueueItem): string[] {
	if (item.Missing) return ["dismiss"];
	switch (item.TargetType) {
		case "post":
		case "comment":
			return item.TargetStatus === "deleted" ? ["dismiss"] : ["dismiss", "hide", "delete"];
		case "product":
			return ["dismiss", "delete"];
		default:
			return ["dismiss"];
	}
}

// The queue groups reports by target, most reported first. Suspending
// the owner is done from the member list (linked).
export default async function AdminReportsPage({ searchParams }: { searchParams: SearchParams }) {
	if (!(await isAdmin())) return null;
	const status = param(searchParams, "status") || "open";
	const list = await adminGet<AdminPage<QueueItem>>(`/reports${apiQuery(searchParams, ["status", "type", "page"])}`);

	return (
		<Panel>
			<h2>신고</h2>
			<Note>같은 대상에 대한 신고를 묶어 보여줘요. 가입 7일 이상 회원의 신고 3건이 쌓이면 글·댓글은 자동으로 숨겨져요.</Note>
			<AdminListFilters
				selects={[
					{
						name: "status", label: "상태", value: status,
						options: [{ value: "open", label: "처리 대기" }, { value: "resolved", label: "처리됨" }, { value: "dismissed", label: "기각" }],
					},
					{
						name: "type", label: "대상", value: param(searchParams, "type"),
						options: [{ value: "", label: "전체" }, { value: "post", label: "글" }, { value: "comment", label: "댓글" }, { value: "product", label: "상품" }, { value: "user", label: "회원" }],
					},
				]}
			/>
			<TableWrap>
				<Table>
					<thead>
						<tr><th>대상</th><th>작성자</th><th>신고</th><th>상태</th><th>마지막 신고</th>{status === "open" && <th>처리</th>}</tr>
					</thead>
					<tbody>
						{list.Items.map(item => (
							<tr key={`${item.TargetType}:${item.TargetId}`}>
								<td style={{ maxWidth: 360 }}>
									<RoleBadge>{TYPE_LABEL[item.TargetType] ?? item.TargetType}</RoleBadge>{" "}
									{item.Missing ? <em>이미 사라진 대상</em> : <Link href={item.Link} target="_blank">{item.Title || "(제목 없음)"}</Link>}
									{item.Body && <div><small>{item.Body}</small></div>}
									{item.Flags?.map(f => <div key={f}><small>⚠ {warningText(f).title}</small></div>)}
								</td>
								<td>
									{item.OwnerId
										? <Link href={`/admin/users?q=${encodeURIComponent(item.OwnerEmail || item.OwnerNickname)}`}>{item.OwnerNickname || "(탈퇴)"}</Link>
										: "—"}
									{item.Anonymous && <div><small>익명으로 작성</small></div>}
								</td>
								<td>
									<strong>{item.Count}건</strong> <small>(집계 {item.Counted})</small>
									{Object.entries(item.Reasons).map(([r, n]) => <div key={r}><small>{r} {n}</small></div>)}
									{item.Details?.map((d, i) => <div key={i}><small>“{d}”</small></div>)}
								</td>
								<td>{STATUS_LABEL[item.TargetStatus] ?? (item.TargetStatus || "—")}</td>
								<td>{formatDateTime(item.LastAt)}</td>
								{status === "open" && <td><ReportActions targetType={item.TargetType} targetId={item.TargetId} actions={actionsFor(item)} /></td>}
							</tr>
						))}
					</tbody>
				</Table>
				{list.Items.length === 0 && <EmptyRow>{status === "open" ? "처리할 신고가 없어요." : "해당하는 신고가 없어요."}</EmptyRow>}
			</TableWrap>
			<AdminPagination pathname="/admin/reports" params={searchParams} page={list.Page} totalPages={list.TotalPages} total={list.Total} />
		</Panel>
	);
}
