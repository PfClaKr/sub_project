import { Metadata } from "next";
import { SearchInput } from "@/components/SearchInput";
import { PageHeader, Section, SectionTitle, Row } from "@/styles/styledLayout";
import { Chip } from "@/styles/styledUi";
import { CATEGORIES } from "@/libs/constants";

export const metadata: Metadata = {
	title: "상품찾기",
};

export default function SearchPage() {
	return (
		<div>
			<PageHeader>
				<h1>상품찾기</h1>
				<p>찾는 물건 이름으로 검색해보세요.</p>
			</PageHeader>
			<SearchInput />
			<Section>
				<SectionTitle>카테고리로 둘러보기</SectionTitle>
				<Row>
					{CATEGORIES.map(c => (
						<Chip key={c} href={`/?category=${encodeURIComponent(c)}`}>{c}</Chip>
					))}
				</Row>
			</Section>
		</div>
	);
}
