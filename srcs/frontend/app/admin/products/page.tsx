import { getLocale, getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { getLabels } from "@/libs/labels.server";
import type { Locale } from "@/i18n/config";
import Link from "next/link";
import { AdminListFilters } from "@/components/admin/AdminListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ProductDeleteControl, ProductStatusControl } from "@/components/admin/Controls";
import { adminGet, isAdmin, type AdminPage } from "@/libs/adminApi";
import { apiQuery, param, type SearchParams } from "@/libs/adminParams";
import { CATEGORIES, STATUSES } from "@/libs/constants";
import { formatDate, formatPrice, imageUrl } from "@/libs/format";
import { EmptyRow, Panel, Table, TableWrap, Thumb, Who } from "@/styles/styledAdmin";

export const generateMetadata = pageMetadata("admin.products");

type Product = {
	ProductId: string; ProductName: string; ProductStatus: string; ProductCategory: string;
	ProductPrice: number; ProductImage: string; PreferedLocation: string; ProductCreatedAt: number;
	UserId: string; SellerNickname: string; SellerEmail: string;
};

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
	if (!(await isAdmin())) return null;
	const list = await adminGet<AdminPage<Product>>(
		`/products${apiQuery(searchParams, ["q", "status", "category", "sort", "page"])}`,
	);
	const t = await getTranslations("admin");
	const L = await getLabels();
	const locale = (await getLocale()) as Locale;

	return (
		<Panel>
			<h2>{t("products.title")}</h2>
			<AdminListFilters
				search={param(searchParams, "q")}
				placeholder={t("products.placeholder")}
				selects={[
					{ name: "status", label: t("products.status"), value: param(searchParams, "status"),
						options: [{ value: "", label: t("all") }, ...STATUSES.map(s => ({ value: s, label: L.enum("status", s) }))] },
					{ name: "category", label: t("products.category"), value: param(searchParams, "category"),
						options: [{ value: "", label: t("all") }, ...CATEGORIES.map(c => ({ value: c, label: L.enum("category", c) }))] },
					{ name: "sort", label: t("products.sort"), value: param(searchParams, "sort"),
						options: [
							{ value: "", label: t("products.newest") }, { value: "oldest", label: t("products.oldest") },
							{ value: "price_asc", label: t("products.priceAsc") }, { value: "price_desc", label: t("products.priceDesc") },
						] },
				]}
			/>
			<TableWrap>
				<Table>
					<thead>
						<tr><th>{t("products.colItem")}</th><th>{t("products.colSeller")}</th><th>{t("products.colPrice")}</th><th>{t("products.colCategory")}</th><th>{t("products.colStatus")}</th><th>{t("products.colDate")}</th><th>{t("products.colManage")}</th></tr>
					</thead>
					<tbody>
						{list.Items.map(p => {
							const thumb = imageUrl(p.ProductImage);
							return (
								<tr key={p.ProductId}>
									<td>
										<Who>
											{thumb ? <Thumb src={thumb} alt="" /> : <Thumb as="span" />}
											<div>
												<Link href={`/product/${p.ProductId}`}>{p.ProductName}</Link>
												<small>{p.PreferedLocation}</small>
											</div>
										</Who>
									</td>
									<td data-label={t("products.colSeller")}>
										<Link href={`/user/${p.UserId}`}>{p.SellerNickname || t("left")}</Link>
										<Who><small>{p.SellerEmail}</small></Who>
									</td>
									<td data-label={t("products.colPrice")}>{formatPrice(p.ProductPrice, locale)}</td>
									<td data-label={t("products.colCategory")}>{L.enum("category", p.ProductCategory)}</td>
									<td data-label={t("products.colStatus")}><ProductStatusControl productId={p.ProductId} status={p.ProductStatus || "판매중"} /></td>
									<td data-label={t("products.colDate")}>{formatDate(p.ProductCreatedAt, locale)}</td>
									<td><ProductDeleteControl productId={p.ProductId} name={p.ProductName} /></td>
								</tr>
							);
						})}
					</tbody>
				</Table>
				{list.Items.length === 0 && <EmptyRow>{t("products.empty")}</EmptyRow>}
			</TableWrap>
			<AdminPagination pathname="/admin/products" params={searchParams} page={list.Page} totalPages={list.TotalPages} total={list.Total} />
		</Panel>
	);
}
