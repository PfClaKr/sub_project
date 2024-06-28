import { Metadata } from "next";

export const metadata: Metadata = {
	title: "Result",
};

async function getSearchResult(id: string) {
	return await fetch('http://golang:8080/graphql', {
		method: 'POST',
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			query: `{
				productSearch(ProductName: \"${id}\") {
					ProductId
					UserId
					ProductName
				}
			}`
		})
	}).then(response => response.json());
}

export default async function SearchResultPage({params: {id}}: {params: {id: string}; }) {
	const result = await getSearchResult(decodeURIComponent(id));
	return (
		<div>
			<p>상세페이지</p>
			<p>"{id}" 검색 결과</p>
			<p>{JSON.stringify(result)}</p>
			<p>{result.data.productSearch[0].ProductId}</p>
			<p>{result.data.productSearch[0].UserId}</p>
			<p>{result.data.productSearch[1].ProductId}</p>
			<p>{result.data.productSearch[1].UserId}</p>
		</div>
	);
}
