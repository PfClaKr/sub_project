import { getLocale, getTranslations } from "next-intl/server";
import { getSite } from "@/libs/site.server";
import type { HomeSectionId } from "@/libs/site";
import { Fragment } from "react";
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
	const t = await getTranslations("home.recent");

	// Section order and visibility come from /admin/site.
	const { Settings: site } = await getSite(await getLocale());
	const sections: Record<HomeSectionId, React.ReactNode> = {
		purposes: <PurposeCards counts={counts} />,
		checklist: <NewcomerChecklist />,
		feed: <NeighborFeed />,
		recent: (
			<section aria-labelledby="recent">
				<SectionHead>
					<div>
						<h2 id="recent">{t("title")}</h2>
						<p>{t("lead")}</p>
					</div>
					<LinkButton href="/search" $ghost>{t("more")}</LinkButton>
				</SectionHead>
				{error && <ErrorText role="alert">{error}</ErrorText>}
				{!error && products.length === 0 ? (
					<EmptyState>
						<p>{t("empty")}</p>
						<LinkButton href="/sell">{t("first")}</LinkButton>
					</EmptyState>
				) : (
					<Reveal><ProductGrid products={products} preview /></Reveal>
				)}
			</section>
		),
		trust: <TrustAndJoin />,
	};

	return (
		<div>
			<LandingHero image={site.Hero} />
			{site.Home.filter(s => s.Enabled && sections[s.Id]).map(s => <Fragment key={s.Id}>{sections[s.Id]}</Fragment>)}
		</div>
	);
}
