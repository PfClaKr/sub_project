import { Metadata } from "next";

export const metadata: Metadata = {
	title: "Result",
};

async function getSearchResult(id: string) {
	return await fetch('http://golang:8080/graphql', {
		method: 'POST',
		headers: {

		},
		body: JSON.stringify({
			query: `{
				query { itemSearch(Title: ${id}) } {
					id
				}
			}`
		})
	}).then(response => response.json());
}

export default async function SearchResultPage({params: {id}}: {params: {id: string}; }) {
	const result = await getSearchResult(id);
	return (
		<div>
			<p>상세페이지</p>
			<p>"{id}" 검색 결과</p>
			<p>{result.id}</p>
		</div>
	);
}
