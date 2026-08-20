import { Metadata } from "next";
import DisplayTray from "@/components/product/DisplayTray";
import { GRAPHQL_URL } from "@/libs/config";

export const metadata: Metadata = {
	title: "Result",
};

async function getSearchResult(searchKeyword: string) {
	try {
		const response = await fetch(GRAPHQL_URL, {
			signal: AbortSignal.timeout(5000), // prevent infinite loading
			method: 'POST',
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				query: `query ProductSearch($productName: String!) {
					productSearch(ProductName: $productName) {
						ProductId
						UserId
						ProductStatus
						ProductName
						ProductImage
						ProductPrice
						PreferedLocation
					}
				}`,
				variables: { productName: searchKeyword },
			}),
			cache: 'no-store',
		});
		if (!response.ok) return [];
		const json = await response.json();
		return json.data?.productSearch ?? [];
	} catch {
		return [];
	}
}

export default async function SearchResultPage({params: {id}}: {params: {id: string}; }) {
	// decode to support special characters, e.g. korean letters
	const searchKeyword = decodeURIComponent(id);
	const products = await getSearchResult(searchKeyword);
	const searchStatus = products.length > 0
		? `${products.length} ${products.length > 1 ? "Results" : "Result"}`
		: "검색 결과가 없어요.";
	return (
		<div>
			<p>상세페이지</p>
			<p>"{searchKeyword}" 검색 결과</p>
			<p>{searchStatus}</p>
			<section>
				<DisplayTray
					products={products}
				/>
			</section>
		</div>
	);
}
