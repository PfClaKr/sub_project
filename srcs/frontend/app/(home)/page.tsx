import ProductGrid from "@/components/product/ProductGrid";
import { CategoryChips } from "@/components/product/CategoryChips";
import { LandingHero } from "@/components/landing/LandingHero";
import { CallToAction, CategoryTiles, HowItWorks, MarketStats } from "@/components/landing/LandingSections";
import { Reveal } from "@/components/landing/Reveal";
import { SectionHead } from "@/styles/styledLanding";
import { EmptyState, ErrorText, LinkButton, Pagination } from "@/styles/styledUi";
import { gql, PRODUCT_CARD_FIELDS } from "@/libs/graphql";
import { CATEGORIES, PAGE_SIZE } from "@/libs/constants";
import type { Product } from "@/libs/types";

type Props = { searchParams: { category?: string; page?: string } };
type Stats = { Products: number; Selling: number; Users: number };

// The landing page is also the app's home: hero and search on top, then
// the live listings, then the "how it works" pitch for newcomers.
export default async function HomePage({ searchParams }: Props) {
	const category = CATEGORIES.find(c => c === searchParams.category);
	const page = Math.max(1, Number(searchParams.page) || 1);

	// Ask for one extra item to know whether a next page exists.
	const { data, error } = await gql<{ recentProducts: Product[]; marketStats: Stats | null }>(
		`query Home($limit: Float, $offset: Float, $category: String) {
			recentProducts(Limit: $limit, Offset: $offset, Category: $category) { ${PRODUCT_CARD_FIELDS} }
			marketStats { Products Selling Users }
		}`,
		{ limit: PAGE_SIZE + 1, offset: (page - 1) * PAGE_SIZE, category },
	);
	const all = data?.recentProducts ?? [];
	const products = all.slice(0, PAGE_SIZE);
	const hasNext = all.length > PAGE_SIZE;

	const pageHref = (p: number) => {
		const q = new URLSearchParams();
		if (category) q.set("category", category);
		if (p > 1) q.set("page", String(p));
		const s = q.toString();
		return `${s ? `/?${s}` : "/"}#recent`;
	};

	return (
		<div>
			<LandingHero />
			<MarketStats stats={data?.marketStats ?? null} />

			<section id="recent" aria-labelledby="recent-title" style={{ scrollMarginTop: 80 }}>
				<SectionHead>
					<div>
						<h2 id="recent-title">{category ? `${category} 최신 상품` : "최근에 올라온거 뭐있냥?"}</h2>
						<p>방금 올라온 물건부터 보여드려요.</p>
					</div>
				</SectionHead>
				<CategoryChips active={category} />

				{error && <ErrorText role="alert">{error}</ErrorText>}
				{!error && products.length === 0 ? (
					<EmptyState>
						<p>{category ? `아직 ${category} 상품이 없어요.` : "아직 올라온 물건이 없어요."}</p>
						<LinkButton href="/sell">첫 상품 올리기</LinkButton>
					</EmptyState>
				) : (
					<Reveal><ProductGrid products={products} /></Reveal>
				)}

				{(page > 1 || hasNext) && (
					<Pagination aria-label="페이지">
						{page > 1 && <LinkButton href={pageHref(page - 1)} $ghost>← 이전</LinkButton>}
						<span>{page} 페이지</span>
						{hasNext && <LinkButton href={pageHref(page + 1)} $ghost>다음 →</LinkButton>}
					</Pagination>
				)}
			</section>

			<CategoryTiles active={category} />
			<HowItWorks />
			<CallToAction />
		</div>
	);
}
