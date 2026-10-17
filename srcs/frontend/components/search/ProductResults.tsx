import ProductGrid from "@/components/product/ProductGrid";
import { SearchControls } from "@/components/search/SearchControls";
import { Section } from "@/styles/styledLayout";
import { Chip, ChipRow, EmptyState, ErrorText, LinkButton, Muted, Pagination } from "@/styles/styledUi";
import { gql, PRODUCT_CARD_FIELDS } from "@/libs/graphql";
import { distanceLabel } from "@/libs/geo";
import { CATEGORIES, REGIONS } from "@/libs/constants";
import type { Product } from "@/libs/types";

export type ProductSearchParams = {
	category?: string; sort?: string; area?: string; lat?: string; lng?: string; km?: string;
	place?: string; region?: string; min?: string; max?: string; page?: string;
};

const SORT_VALUES = ["newest", "price_asc", "price_desc", "distance"];

// ProductResults runs productSearch from the URL: with a keyword it is a
// search (/search/<q>), without one the 중고 tab's browsable list (/search),
// newest first and paged. Filters live in the URL so results are shareable.
export async function ProductResults({ q, searchParams }: { q: string; searchParams: ProductSearchParams }) {
	const browse = q === "";
	const category = CATEGORIES.find(c => c === searchParams.category);
	const region = REGIONS.find(r => r === searchParams.region);
	const price = (v?: string) => (v && Number(v) > 0 ? Number(v) : undefined);
	const minPrice = price(searchParams.min);
	const maxPrice = price(searchParams.max);
	// Place filter: inside the area (km 0) or within km of lat/lng.
	const lat = Number(searchParams.lat);
	const lng = Number(searchParams.lng);
	const hasPoint = !!searchParams.lat && !!searchParams.lng && Number.isFinite(lat) && Number.isFinite(lng);
	const km = Math.min(Math.max(Number(searchParams.km) || 0, 0), 200);
	const area = /^[NWR]\d+$/.test(searchParams.area ?? "") ? searchParams.area : undefined;
	const near = (km === 0 && area) || (km > 0 && hasPoint)
		? { area: km === 0 ? area : undefined, lat: hasPoint ? lat : undefined, lng: hasPoint ? lng : undefined, km }
		: null;
	const sort = SORT_VALUES.includes(searchParams.sort ?? "") && (searchParams.sort !== "distance" || near)
		? searchParams.sort
		: undefined;
	const page = browse ? Math.max(1, Math.floor(Number(searchParams.page)) || 1) : 1;

	const { data, error } = await gql<{ productSearch: { Products: Product[]; Corrected: boolean; HasNext: boolean } }>(
		`query Search($q: String!, $category: String, $region: String, $min: Float, $max: Float, $sort: String, $area: String, $lat: Float, $lng: Float, $km: Float, $page: Int) {
			productSearch(ProductName: $q, Category: $category, Region: $region, MinPrice: $min, MaxPrice: $max, Sort: $sort, AreaId: $area, Latitude: $lat, Longitude: $lng, DistanceKm: $km, Page: $page) {
				Corrected
				HasNext
				Products { ${PRODUCT_CARD_FIELDS} }
			}
		}`,
		{ q, category, region, min: minPrice, max: maxPrice, sort, area: near?.area, lat: near?.lat, lng: near?.lng, km: near ? near.km : undefined, page },
		{ timeoutMs: 5000 },
	);
	const products = data?.productSearch?.Products ?? [];
	const corrected = data?.productSearch?.Corrected ?? false;
	const hasNext = data?.productSearch?.HasNext ?? false;

	// Category chips and pages keep the other filters.
	const keep = new URLSearchParams();
	if (sort) keep.set("sort", sort);
	if (region) keep.set("region", region);
	if (minPrice) keep.set("min", String(minPrice));
	if (maxPrice) keep.set("max", String(maxPrice));
	if (near) {
		for (const k of ["area", "lat", "lng", "km", "place"] as const) {
			const v = searchParams[k];
			if (v) keep.set(k, v);
		}
	}
	const base = browse ? "/search" : `/search/${encodeURIComponent(q)}`;
	const href = (changes: { category?: string; page?: number }) => {
		const p = new URLSearchParams(keep);
		const c = "category" in changes ? changes.category : category;
		if (c) p.set("category", c);
		if (changes.page && changes.page > 1) p.set("page", String(changes.page));
		const s = p.toString();
		return s ? `${base}?${s}` : base;
	};
	const filtered = !!(near || category || region || minPrice || maxPrice);

	return (
		<Section>
			<ChipRow aria-label="카테고리">
				<Chip href={href({ category: undefined })} $active={!category} scroll={false}>전체</Chip>
				{CATEGORIES.map(c => (
					<Chip key={c} href={href({ category: c })} $active={category === c} scroll={false}>
						{c}
					</Chip>
				))}
			</ChipRow>
			{!error && <SearchControls total={products.length} browse={browse} />}
			{corrected && products.length > 0 && (
				<p><Muted>정확히 일치하는 상품이 없어 비슷한 상품을 보여드려요.</Muted></p>
			)}
			{error ? (
				<ErrorText role="alert">{error}</ErrorText>
			) : products.length === 0 ? (
				<EmptyState>
					<p>
						{near ? `${searchParams.place ?? "선택한 위치"} (${distanceLabel(near.km)})에서 ` : ""}
						{category ? `${category}에서 ` : ""}
						{browse ? "조건에 맞는 상품이 없어요." : "검색 결과가 없어요."}
					</p>
					{filtered
						? <LinkButton href={base} $ghost>조건 없이 다시 보기</LinkButton>
						: <LinkButton href={browse ? "/sell" : "/search"} $ghost>{browse ? "첫 상품 올리기" : "전체 상품 보기"}</LinkButton>}
				</EmptyState>
			) : (
				<ProductGrid products={products} />
			)}
			{browse && (page > 1 || hasNext) && (
				<Pagination aria-label="페이지">
					{page > 1 && <LinkButton href={href({ page: page - 1 })} $ghost>← 이전</LinkButton>}
					<span>{page} 페이지</span>
					{hasNext && <LinkButton href={href({ page: page + 1 })} $ghost>다음 →</LinkButton>}
				</Pagination>
			)}
		</Section>
	);
}
