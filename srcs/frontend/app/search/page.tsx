import { Metadata } from "next";
import { SearchInput } from "../../components/SearchInput";
import { Hero, HeroTag } from "@/styles/styledHome";
import { ChipRow } from "@/styles/styledCommon";
import { KeywordChip } from "@/styles/styledChip";

export const metadata: Metadata = {
	title: "Search",
};

const POPULAR_KEYWORDS = ["아이폰", "이케아", "자전거", "책상", "패딩", "모니터", "유모차", "에어프라이어"];

export default function SearchPage() {
	return (
		<div>
			<Hero>
				<HeroTag>상품 검색</HeroTag>
				<h1>어떤 물건을 찾고 있냥?</h1>
				<SearchInput />
				<ChipRow>
					{POPULAR_KEYWORDS.map(keyword => (
						<KeywordChip key={keyword} href={`/search/${keyword}`}>
							{keyword}
						</KeywordChip>
					))}
				</ChipRow>
			</Hero>
		</div>
	);
}
