import { Metadata } from "next";

export const metadata: Metadata = {
	title: "Result",
};

export default function SearchResultPage({params: {id}}: {params: {id: string}; }) {
	return (
		<div>
			<p>상세페이지</p>
			<p>"{id}" 검색 결과</p>
		</div>
	);
}
