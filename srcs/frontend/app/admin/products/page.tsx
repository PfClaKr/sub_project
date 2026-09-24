import { Metadata } from "next";
import Link from "next/link";
import { AdminListFilters } from "@/components/admin/AdminListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { ProductDeleteControl, ProductStatusControl } from "@/components/admin/Controls";
import { adminGet, isAdmin, type AdminPage } from "@/libs/adminApi";
import { apiQuery, param, type SearchParams } from "@/libs/adminParams";
import { CATEGORIES, STATUSES } from "@/libs/constants";
import { formatDate, formatPrice, imageUrl } from "@/libs/format";
import { EmptyRow, Panel, Table, TableWrap, Thumb, Who } from "@/styles/styledAdmin";

export const metadata: Metadata = { title: "상품" };

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

	return (
		<Panel>
			<h2>상품</h2>
			<AdminListFilters
				search={param(searchParams, "q")}
				placeholder="상품명, 판매자 닉네임·이메일"
				selects={[
					{ name: "status", label: "상태", value: param(searchParams, "status"),
						options: [{ value: "", label: "전체" }, ...STATUSES.map(s => ({ value: s, label: s }))] },
					{ name: "category", label: "카테고리", value: param(searchParams, "category"),
						options: [{ value: "", label: "전체" }, ...CATEGORIES.map(c => ({ value: c, label: c }))] },
					{ name: "sort", label: "정렬", value: param(searchParams, "sort"),
						options: [
							{ value: "", label: "최신 등록순" }, { value: "oldest", label: "오래된 순" },
							{ value: "price_asc", label: "낮은 가격순" }, { value: "price_desc", label: "높은 가격순" },
						] },
				]}
			/>
			<TableWrap>
				<Table>
					<thead>
						<tr><th>상품</th><th>판매자</th><th>가격</th><th>카테고리</th><th>상태</th><th>등록일</th><th>관리</th></tr>
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
									<td>
										<Link href={`/user/${p.UserId}`}>{p.SellerNickname || "(탈퇴)"}</Link>
										<Who><small>{p.SellerEmail}</small></Who>
									</td>
									<td>{formatPrice(p.ProductPrice)}</td>
									<td>{p.ProductCategory}</td>
									<td><ProductStatusControl productId={p.ProductId} status={p.ProductStatus || "판매중"} /></td>
									<td>{formatDate(p.ProductCreatedAt)}</td>
									<td><ProductDeleteControl productId={p.ProductId} name={p.ProductName} /></td>
								</tr>
							);
						})}
					</tbody>
				</Table>
				{list.Items.length === 0 && <EmptyRow>조건에 맞는 상품이 없어요.</EmptyRow>}
			</TableWrap>
			<AdminPagination pathname="/admin/products" params={searchParams} page={list.Page} totalPages={list.TotalPages} total={list.Total} />
		</Panel>
	);
}
