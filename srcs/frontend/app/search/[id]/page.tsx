import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getLabels } from "@/libs/labels.server";
import { SearchInput } from "@/components/SearchInput";
import { ProductResults, type ProductSearchParams } from "@/components/search/ProductResults";
import { PageHeader } from "@/styles/styledLayout";

type Props = {
	params: { id: string };
	searchParams: ProductSearchParams;
};

function keyword(id: string): string {
	try {
		return decodeURIComponent(id);
	} catch {
		return id;
	}
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	return { title: (await getTranslations("market"))("results", { q: keyword(params.id) }) };
}

export default async function SearchResultPage({ params, searchParams }: Props) {
	const q = keyword(params.id);
	const t = await getTranslations("market");
	const L = await getLabels();
	const km = Math.min(Math.max(Number(searchParams.km) || 0, 0), 200);
	return (
		<div>
			<PageHeader>
				<h1>{t("results", { q })}</h1>
				{searchParams.place && <p>{searchParams.place} · {L.distance(km)}</p>}
			</PageHeader>
			<SearchInput initial={q} />
			<ProductResults q={q} searchParams={searchParams} />
		</div>
	);
}
