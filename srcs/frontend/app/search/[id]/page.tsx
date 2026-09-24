import { Metadata } from "next";
import ProductGrid from "@/components/product/ProductGrid";
import { SearchInput } from "@/components/SearchInput";
import { PageHeader, Section } from "@/styles/styledLayout";
import { Chip, ChipRow, EmptyState, ErrorText, LinkButton, Muted } from "@/styles/styledUi";
import { gql, PRODUCT_CARD_FIELDS } from "@/libs/graphql";
import { SearchControls } from "@/components/search/SearchControls";
import { distanceLabel } from "@/libs/geo";
import { CATEGORIES, REGIONS } from "@/libs/constants";
import type { Product } from "@/libs/types";

type Props = {
	params: { id: string };
	searchParams: { category?: string; sort?: string; area?: string; lat?: string; lng?: string; km?: string; place?: string; region?: string; min?: string; max?: string };
};

const SORT_VALUES = ["newest", "price_asc", "price_desc", "distance"];

function keyword(id: string): string {
	try {
		return decodeURIComponent(id);
	} catch {
		return id;
	}
}

export function generateMetadata({ params }: Props): Metadata {
	return { title: `"${keyword(params.id)}" 검색 결과` };
}

export default async function SearchResultPage({ params, searchParams }: Props) {
	const q = keyword(params.id);
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

	const { data, error } = await gql<{ productSearch: { Products: Product[]; Corrected: boolean } }>(
		`query Search($q: String!, $category: String, $region: String, $min: Float, $max: Float, $sort: String, $area: String, $lat: Float, $lng: Float, $km: Float) {
			productSearch(ProductName: $q, Category: $category, Region: $region, MinPrice: $min, MaxPrice: $max, Sort: $sort, AreaId: $area, Latitude: $lat, Longitude: $lng, DistanceKm: $km) {
				Corrected
				Products { ${PRODUCT_CARD_FIELDS} }
			}
		}`,
		{ q, category, region, min: minPrice, max: maxPrice, sort, area: near?.area, lat: near?.lat, lng: near?.lng, km: near ? near.km : undefined },
		{ timeoutMs: 5000 },
	);
	const products = data?.productSearch?.Products ?? [];
	const corrected = data?.productSearch?.Corrected ?? false;
	// Category chips keep the sort and place filter.
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
	const base = `/search/${encodeURIComponent(q)}`;
	const withCat = (c?: string) => {
		const p = new URLSearchParams(keep);
		if (c) p.set("category", c);
		const s = p.toString();
		return s ? `${base}?${s}` : base;
	};

	return (
		<div>
			<PageHeader>
				<h1>&ldquo;{q}&rdquo; 검색 결과</h1>
				{near && searchParams.place && <p>{searchParams.place} · {distanceLabel(near.km)}</p>}
			</PageHeader>
			<SearchInput initial={q} />
			<Section>
				<ChipRow aria-label="카테고리">
					<Chip href={withCat()} $active={!category} scroll={false}>전체</Chip>
					{CATEGORIES.map(c => (
						<Chip key={c} href={withCat(c)} $active={category === c} scroll={false}>
							{c}
						</Chip>
					))}
				</ChipRow>
				{!error && <SearchControls total={products.length} />}
				{corrected && products.length > 0 && (
					<p><Muted>정확히 일치하는 상품이 없어 비슷한 상품을 보여드려요.</Muted></p>
				)}
				{error ? (
					<ErrorText role="alert">{error}</ErrorText>
				) : products.length === 0 ? (
					<EmptyState>
						<p>
							{near ? `${searchParams.place ?? "선택한 위치"} (${distanceLabel(near.km)})에서 ` : ""}
							{category ? `${category}에서 ` : ""}검색 결과가 없어요.
						</p>
						<LinkButton href={near || category ? base : "/"} $ghost>{near || category ? "조건 없이 다시 보기" : "최신 상품 보기"}</LinkButton>
					</EmptyState>
				) : (
					<ProductGrid products={products} />
				)}
			</Section>
		</div>
	);
}
