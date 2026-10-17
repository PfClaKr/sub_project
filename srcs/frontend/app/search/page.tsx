import { Metadata } from "next";
import { SearchInput } from "@/components/SearchInput";
import { ProductResults, type ProductSearchParams } from "@/components/search/ProductResults";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "중고거래",
	description: "파리 한인들이 올린 중고 물건을 카테고리, 동네, 가격으로 찾아보세요.",
};

// The 중고 tab: every product, newest first, with the same filters as a
// keyword search.
export default function SearchPage({ searchParams }: { searchParams: ProductSearchParams }) {
	return (
		<div>
			<PageHeader>
				<h1>중고거래</h1>
				<p>이웃이 올린 물건을 둘러보거나 찾는 물건을 검색해보세요.</p>
			</PageHeader>
			<SearchInput />
			<ProductResults q="" searchParams={searchParams} />
		</div>
	);
}
