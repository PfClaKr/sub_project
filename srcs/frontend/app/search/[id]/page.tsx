import { Metadata } from "next";
import DisplayTray from "@/components/DisplayTray";

export const metadata: Metadata = {
	title: "Result",
};

async function getSearchResult(searchKeyword: string) {
	return await fetch('http://golang:8080/graphql', {
		method: 'POST',
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			query: `{
				productSearch(ProductName: \"${searchKeyword}\") {
					ProductId
					UserId
					ProductName
					ProductImage
					ProductPrice
					PreferedLocation
				}
			}`
		})
	}).then(response => response.json());
}

export default async function SearchResultPage({params: {id}}: {params: {id: string}; }) {
	const searchKeyword = decodeURIComponent(id); // to support special characters - in this case korean letters
	const result = await getSearchResult(searchKeyword);
	const products = result.data.productSearch ? result.data.productSearch : [];
	const searchStatus = products ? products.length > 1 ? products.length + " Results" : products.length + " Result" : "Data Not Found";
	return (
		<div>
			<p>상세페이지</p>
			<p>"{searchKeyword}" 검색 결과</p>
			{searchStatus}
			{/* {JSON.stringify(result)} use for debugging */}
			<section>
				<DisplayTray
					products={products}
				/>
			</section>
		</div>
	);
}
