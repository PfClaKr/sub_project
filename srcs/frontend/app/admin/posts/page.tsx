import { Metadata } from "next";
import Link from "next/link";
import { AdminListFilters } from "@/components/admin/AdminListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { PostStatusControl } from "@/components/admin/Controls";
import { adminGet, isAdmin, type AdminPage } from "@/libs/adminApi";
import { apiQuery, param, type SearchParams } from "@/libs/adminParams";
import { boardLabel, postHref } from "@/libs/community";
import { formatDate } from "@/libs/format";
import { dealLabel, warningText } from "@/libs/listing";
import { EmptyRow, Panel, RoleBadge, Table, TableWrap } from "@/styles/styledAdmin";
import type { Post } from "@/libs/types";

export const metadata: Metadata = { title: "게시글" };

type AdminPost = {
	PostId: string; Type: Post["Type"]; Topic: string; Title: string; Status: string; Deal: string;
	AuthorId: string; AuthorNickname: string; AuthorEmail: string; Anonymous: boolean;
	Flags: string[]; ReportCount: number; CommentCount: number; CreatedAt: number;
};

// Every board in one list. Anonymous posts show their real author here,
// for acting on reports; the "익명" badge marks them.
export default async function AdminPostsPage({ searchParams }: { searchParams: SearchParams }) {
	if (!(await isAdmin())) return null;
	const list = await adminGet<AdminPage<AdminPost>>(`/posts${apiQuery(searchParams, ["q", "type", "status", "flagged", "page"])}`);

	return (
		<Panel>
			<h2>게시글</h2>
			<AdminListFilters
				search={param(searchParams, "q")}
				placeholder="제목, 작성자 닉네임·이메일"
				selects={[
					{
						name: "type", label: "게시판", value: param(searchParams, "type"),
						options: [{ value: "", label: "전체" }, { value: "qna", label: "생활 Q&A" }, { value: "free", label: "자유" }, { value: "housing", label: "집" }, { value: "job", label: "알바" }],
					},
					{
						name: "status", label: "상태", value: param(searchParams, "status"),
						options: [{ value: "", label: "전체" }, { value: "active", label: "공개" }, { value: "hidden", label: "숨김" }, { value: "expired", label: "만료" }, { value: "deleted", label: "삭제" }],
					},
					{
						name: "flagged", label: "경고·신고", value: param(searchParams, "flagged"),
						options: [{ value: "", label: "전체" }, { value: "1", label: "있는 글만" }],
					},
				]}
			/>
			<TableWrap>
				<Table>
					<thead>
						<tr><th>글</th><th>작성자</th><th>경고·신고</th><th>상태</th><th>작성일</th></tr>
					</thead>
					<tbody>
						{list.Items.map(p => (
							<tr key={p.PostId}>
								<td style={{ maxWidth: 380 }}>
									<RoleBadge>{boardLabel(p.Type)}</RoleBadge> <small>{p.Topic}</small>{p.Deal && <small> · {dealLabel(p.Deal)}</small>}
									<div><Link href={postHref(p)} target="_blank">{p.Title}</Link> <small>댓글 {p.CommentCount}</small></div>
								</td>
								<td>
									{p.AuthorNickname
										? <Link href={`/admin/users?q=${encodeURIComponent(p.AuthorEmail || p.AuthorNickname)}`}>{p.AuthorNickname}</Link>
										: "(탈퇴)"}
									{p.Anonymous && <> <RoleBadge>익명</RoleBadge></>}
								</td>
								<td>
									{p.Flags.map(f => <div key={f}><small>⚠ {warningText(f).title}</small></div>)}
									{p.ReportCount > 0 && <Link href="/admin/reports?type=post"><small>신고 {p.ReportCount}건</small></Link>}
									{p.Flags.length === 0 && !p.ReportCount && "—"}
								</td>
								<td><PostStatusControl postId={p.PostId} status={p.Status} /></td>
								<td>{formatDate(p.CreatedAt)}</td>
							</tr>
						))}
					</tbody>
				</Table>
				{list.Items.length === 0 && <EmptyRow>조건에 맞는 글이 없어요.</EmptyRow>}
			</TableWrap>
			<AdminPagination pathname="/admin/posts" params={searchParams} page={list.Page} totalPages={list.TotalPages} total={list.Total} />
		</Panel>
	);
}
