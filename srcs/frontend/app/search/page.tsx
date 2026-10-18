import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { SearchInput } from "@/components/SearchInput";
import { ProductResults, type ProductSearchParams } from "@/components/search/ProductResults";
import { PageHeader } from "@/styles/styledLayout";

export const generateMetadata = pageMetadata("market");

// The 중고 tab: every product, newest first, with the same filters as a
// keyword search.
export default async function SearchPage({ searchParams }: { searchParams: ProductSearchParams }) {
	const t = await getTranslations("market");
	return (
		<div>
			<PageHeader>
				<h1>{t("title")}</h1>
				<p>{t("lead")}</p>
			</PageHeader>
			<SearchInput />
			<ProductResults q="" searchParams={searchParams} />
		</div>
	);
}
