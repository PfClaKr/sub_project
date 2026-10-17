import { Metadata } from "next";
import { SearchInput } from "@/components/SearchInput";
import { ProductResults, type ProductSearchParams } from "@/components/search/ProductResults";
import { PageHeader } from "@/styles/styledLayout";
import { distanceLabel } from "@/libs/geo";

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

export function generateMetadata({ params }: Props): Metadata {
	return { title: `"${keyword(params.id)}" 검색 결과` };
}

export default function SearchResultPage({ params, searchParams }: Props) {
	const q = keyword(params.id);
	const km = Math.min(Math.max(Number(searchParams.km) || 0, 0), 200);
	return (
		<div>
			<PageHeader>
				<h1>&ldquo;{q}&rdquo; 검색 결과</h1>
				{searchParams.place && <p>{searchParams.place} · {distanceLabel(km)}</p>}
			</PageHeader>
			<SearchInput initial={q} />
			<ProductResults q={q} searchParams={searchParams} />
		</div>
	);
}
