import { getTranslations } from "next-intl/server";
import ProductGrid from "@/components/product/ProductGrid";
import { getLabels } from "@/libs/labels.server";
import { SearchControls } from "@/components/search/SearchControls";
import { Section } from "@/styles/styledLayout";
import { Chip, ChipRow, EmptyState, ErrorText, LinkButton, Muted, Pagination } from "@/styles/styledUi";
import { gql, PRODUCT_CARD_FIELDS } from "@/libs/graphql";
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
	const t = await getTranslations("market");
	const c = await getTranslations("common");
	const L = await getLabels();
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
		{ timeoutMs: 5000, revalidate: 30 },
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
			<ChipRow aria-label={t("categories")}>
				<Chip href={href({ category: undefined })} $active={!category} scroll={false}>{t("all")}</Chip>
				{CATEGORIES.map(cat => (
					<Chip key={cat} href={href({ category: cat })} $active={category === cat} scroll={false}>
						{L.enum("category", cat)}
					</Chip>
				))}
			</ChipRow>
			{!error && <SearchControls total={products.length} browse={browse} />}
			{corrected && products.length > 0 && (
				<p><Muted>{t("corrected")}</Muted></p>
			)}
			{error ? (
				<ErrorText role="alert">{error}</ErrorText>
			) : products.length === 0 ? (
				<EmptyState>
					<p>
						{near ? t("emptyNear", { place: searchParams.place ?? t("chosenPlace"), distance: L.distance(near.km) }) : ""}
						{category ? t("emptyCategory", { category: L.enum("category", category) }) : ""}
						{browse ? t("emptyBrowse") : t("emptySearch")}
					</p>
					{filtered
						? <LinkButton href={base} $ghost>{t("clearFilters")}</LinkButton>
						: <LinkButton href={browse ? "/sell" : "/search"} $ghost>{browse ? t("firstItem") : t("allItems")}</LinkButton>}
				</EmptyState>
			) : (
				<ProductGrid products={products} />
			)}
			{browse && (page > 1 || hasNext) && (
				<Pagination aria-label={t("pages")}>
					{page > 1 && <LinkButton href={href({ page: page - 1 })} $ghost>{c("prev")}</LinkButton>}
					<span>{t("page", { page })}</span>
					{hasNext && <LinkButton href={href({ page: page + 1 })} $ghost>{c("next")}</LinkButton>}
				</Pagination>
			)}
		</Section>
	);
}
