import { getLocale, getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import type { Locale } from "@/i18n/config";
import Link from "next/link";
import { AdminListFilters } from "@/components/admin/AdminListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { adminGet, isAdmin, type AdminPage } from "@/libs/adminApi";
import { apiQuery, param, type SearchParams } from "@/libs/adminParams";
import { formatDateTime } from "@/libs/format";
import { EmptyRow, Panel, Table, TableWrap, Who } from "@/styles/styledAdmin";

export const generateMetadata = pageMetadata("admin.chats");

export type AdminRoom = {
	ChatId: string; ProductId: string; ProductName: string;
	SellerId: string; SellerNickname: string; SellerEmail: string;
	BuyerId: string; BuyerNickname: string; BuyerEmail: string;
	CreatedAt: number; MessageCount: number; LastActivity: number;
};

export default async function AdminConversationsPage({ searchParams }: { searchParams: SearchParams }) {
	if (!(await isAdmin())) return null;
	const list = await adminGet<AdminPage<AdminRoom>>(`/conversations${apiQuery(searchParams, ["q", "page"])}`);
	const t = await getTranslations("admin");
	const locale = (await getLocale()) as Locale;

	return (
		<Panel>
			<h2>{t("chats.title")}</h2>
			<AdminListFilters search={param(searchParams, "q")} placeholder={t("chats.placeholder")} />
			<TableWrap>
				<Table>
					<thead>
						<tr><th>{t("chats.colItem")}</th><th>{t("chats.colSeller")}</th><th>{t("chats.colBuyer")}</th><th>{t("chats.colMessages")}</th><th>{t("chats.colLast")}</th><th></th></tr>
					</thead>
					<tbody>
						{list.Items.map(r => (
							<tr key={r.ChatId}>
								<td>{r.ProductName || t("deletedItem")}</td>
								<td data-label={t("chats.colSeller")}><Who><div>{r.SellerNickname || t("left")}<small>{r.SellerEmail}</small></div></Who></td>
								<td data-label={t("chats.colBuyer")}><Who><div>{r.BuyerNickname || t("left")}<small>{r.BuyerEmail}</small></div></Who></td>
								<td data-label={t("chats.colMessages")}>{r.MessageCount}</td>
								<td data-label={t("chats.colLast")}>{formatDateTime(r.LastActivity, locale)}</td>
								<td><Link href={`/admin/conversations/${r.ChatId}`}>{t("chats.open")}</Link></td>
							</tr>
						))}
					</tbody>
				</Table>
				{list.Items.length === 0 && <EmptyRow>{t("chats.empty")}</EmptyRow>}
			</TableWrap>
			<AdminPagination pathname="/admin/conversations" params={searchParams} page={list.Page} totalPages={list.TotalPages} total={list.Total} />
		</Panel>
	);
}
