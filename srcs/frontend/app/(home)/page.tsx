import ProductGrid from "@/components/product/ProductGrid";
import { LandingHero } from "@/components/landing/LandingHero";
import { NeighborFeed, NewcomerChecklist, PurposeCards, TrustAndJoin, type HomeCounts } from "@/components/landing/HomeSections";
import { Reveal } from "@/components/landing/Reveal";
import { SectionHead } from "@/styles/styledLanding";
import { EmptyState, ErrorText, LinkButton } from "@/styles/styledUi";
import { gql, PRODUCT_CARD_FIELDS } from "@/libs/graphql";
import type { Product } from "@/libs/types";

type HomeData = {
	recentProducts: Product[];
	marketStats: { Selling: number } | null;
	rooms: { Total: number } | null;
	jobs: { Total: number } | null;
	open: { Total: number } | null;
};

// The home answers "what do you need right now?": the four sections as
// purpose cards with live counts, a checklist for newcomers tied to the
// Q&A, then what neighbours just posted and the newest items.
export default async function HomePage() {
	const { data, error } = await gql<HomeData>(
		`query Home {
			recentProducts(Limit: 12) { ${PRODUCT_CARD_FIELDS} }
			marketStats { Selling }
			rooms: listings(Type: "housing", Size: 1) { Total }
			jobs: listings(Type: "job", Size: 1) { Total }
			open: posts(Type: "qna", Solved: false, Size: 1) { Total }
		}`,
	);
	const counts: HomeCounts = {
		selling: data?.marketStats?.Selling ?? null,
		rooms: data?.rooms?.Total ?? null,
		jobs: data?.jobs?.Total ?? null,
		openQuestions: data?.open?.Total ?? null,
	};
	const products = data?.recentProducts ?? [];

	return (
		<div>
			<LandingHero />
			<PurposeCards counts={counts} />
			<NewcomerChecklist />
			<NeighborFeed />

			<section aria-labelledby="recent">
				<SectionHead>
					<div>
						<h2 id="recent">새로 올라온 물건</h2>
						<p>귀국 정리, 이사 짐. 방금 올라온 물건부터 보여드려요.</p>
					</div>
					<LinkButton href="/search" $ghost>더 보기</LinkButton>
				</SectionHead>
				{error && <ErrorText role="alert">{error}</ErrorText>}
				{!error && products.length === 0 ? (
					<EmptyState>
						<p>아직 올라온 물건이 없어요.</p>
						<LinkButton href="/sell">첫 물건 올리기</LinkButton>
					</EmptyState>
				) : (
					<Reveal><ProductGrid products={products} preview /></Reveal>
				)}
			</section>

			<TrustAndJoin />
		</div>
	);
}
