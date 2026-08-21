import { Metadata } from "next";
import DisplayTray from "@/components/product/DisplayTray";
import { SearchFilters, SearchQuery } from "@/components/search/SearchFilters";
import { PageTitle, EmptyState } from "@/styles/styledCommon";
import { GRAPHQL_URL } from "@/libs/config";

export const metadata: Metadata = {
	title: "Search",
};

async function searchProducts(query: SearchQuery) {
	try {
		const response = await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `query Search($keyword: String, $category: String, $region: String, $min: Float, $max: Float, $sort: String) {
					searchProducts(Keyword: $keyword, Category: $category, Region: $region, MinPrice: $min, MaxPrice: $max, Sort: $sort) {
						ProductId
						UserId
						ProductStatus
						ProductName
						ProductImage
						ProductPrice
						ProductRegion
						PreferedLocation
					}
				}`,
				variables: {
					keyword: query.q ?? null,
					category: query.category ?? null,
					region: query.region ?? null,
					min: query.min ? Number(query.min) : null,
					max: query.max ? Number(query.max) : null,
					sort: query.sort ?? "recent",
				},
			}),
			cache: 'no-store',
		});
		if (!response.ok) return [];
		const json = await response.json();
		return json.data?.searchProducts ?? [];
	} catch {
		return [];
	}
}

export default async function SearchPage({ searchParams }: { searchParams: SearchQuery }) {
	const products = await searchProducts(searchParams);
	const hasQuery = Boolean(searchParams.q || searchParams.category || searchParams.region || searchParams.min || searchParams.max);

	return (
		<div>
			<PageTitle>
				{searchParams.q ? `"${searchParams.q}" 검색 결과 (${products.length})` : `상품 찾기 (${products.length})`}
			</PageTitle>
			<SearchFilters current={searchParams} />
			{products.length > 0 ? (
				<DisplayTray products={products} />
			) : (
				<EmptyState>
					{hasQuery ? "조건에 맞는 상품이 없어요. 필터를 바꿔보세요." : "아직 올라온 상품이 없어요."}
				</EmptyState>
			)}
		</div>
	);
}
