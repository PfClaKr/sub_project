import { Metadata } from "next";
import Link from "next/link";
import { AdminListFilters } from "@/components/admin/AdminListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { adminGet, isAdmin, type AdminPage } from "@/libs/adminApi";
import { apiQuery, param, type SearchParams } from "@/libs/adminParams";
import { formatDateTime } from "@/libs/format";
import { EmptyRow, Panel, Table, TableWrap, Who } from "@/styles/styledAdmin";

export const metadata: Metadata = { title: "채팅" };

export type AdminRoom = {
	ChatId: string; ProductId: string; ProductName: string;
	SellerId: string; SellerNickname: string; SellerEmail: string;
	BuyerId: string; BuyerNickname: string; BuyerEmail: string;
	CreatedAt: number; MessageCount: number; LastActivity: number;
};

export default async function AdminConversationsPage({ searchParams }: { searchParams: SearchParams }) {
	if (!(await isAdmin())) return null;
	const list = await adminGet<AdminPage<AdminRoom>>(`/conversations${apiQuery(searchParams, ["q", "page"])}`);

	return (
		<Panel>
			<h2>채팅</h2>
			<AdminListFilters search={param(searchParams, "q")} placeholder="상품명, 참여자 닉네임·이메일" />
			<TableWrap>
				<Table>
					<thead>
						<tr><th>상품</th><th>판매자</th><th>구매자</th><th>메시지</th><th>마지막 활동</th><th></th></tr>
					</thead>
					<tbody>
						{list.Items.map(r => (
							<tr key={r.ChatId}>
								<td>{r.ProductName || "(삭제된 상품)"}</td>
								<td><Who><div>{r.SellerNickname || "(탈퇴)"}<small>{r.SellerEmail}</small></div></Who></td>
								<td><Who><div>{r.BuyerNickname || "(탈퇴)"}<small>{r.BuyerEmail}</small></div></Who></td>
								<td>{r.MessageCount}</td>
								<td>{formatDateTime(r.LastActivity)}</td>
								<td><Link href={`/admin/conversations/${r.ChatId}`}>대화 보기 →</Link></td>
							</tr>
						))}
					</tbody>
				</Table>
				{list.Items.length === 0 && <EmptyRow>조건에 맞는 채팅이 없어요.</EmptyRow>}
			</TableWrap>
			<AdminPagination pathname="/admin/conversations" params={searchParams} page={list.Page} totalPages={list.TotalPages} total={list.Total} />
		</Panel>
	);
}
