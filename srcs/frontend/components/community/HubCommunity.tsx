'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { gql, POST_LIST_FIELDS } from "@/libs/graphql";
import { useRegion } from "@/libs/region";
import { HubCard, HubGrid } from "@/styles/styledCommunity";
import { Muted } from "@/styles/styledUi";
import { SectionHead } from "@/styles/styledLanding";
import { PostList, PostListSkeleton } from "./PostList";
import { RegionChip } from "./RegionChip";
import type { PostPage } from "@/libs/types";

const QUERY = `query Hub($city: String) {
	open: posts(Type: "qna", Solved: false, City: $city, Size: 4) { Items { ${POST_LIST_FIELDS} } }
	popular: posts(Type: "community", Sort: "popular", City: $city, Size: 4) { Items { ${POST_LIST_FIELDS} } }
}`;

type Data = { open: PostPage; popular: PostPage };

const EMPTY: PostPage = { Items: [], Page: 1, TotalPages: 0, Total: 0 };

// HubCommunity is the home page's community block: questions waiting for
// an answer and what people are talking about, in the chosen region.
export function HubCommunity() {
	const { city } = useRegion();
	const [data, setData] = useState<Data | null>(null);

	useEffect(() => {
		let alive = true;
		setData(null);
		gql<Data>(QUERY, { city: city || null }).then(({ data }) => alive && setData(data ?? { open: EMPTY, popular: EMPTY }));
		return () => {
			alive = false;
		};
	}, [city]);

	const card = (title: string, href: string, page: PostPage | undefined, empty: string) => (
		<HubCard aria-label={title}>
			<header>
				<h2>{title}</h2>
				<Link href={href}>더 보기</Link>
			</header>
			{!data ? <PostListSkeleton count={3} /> : page && page.Items.length > 0
				? <PostList posts={page.Items} showBoard={false} />
				: <Muted as="p" style={{ padding: "12px 0" }}>{empty}</Muted>}
		</HubCard>
	);

	return (
		<section aria-labelledby="hub-community" style={{ marginTop: 32 }}>
			<SectionHead style={{ flexWrap: "wrap" }}>
				<div>
					<h2 id="hub-community">이웃들은 지금 뭐 물어보냥?</h2>
					<p>체류증부터 맛집까지, 파리 생활은 같이 물어보면 쉬워요.</p>
				</div>
				<RegionChip />
			</SectionHead>
			<HubGrid>
				{card("답을 기다리는 질문", "/community?board=qna&solved=open", data?.open, "지금은 모든 질문에 답이 달렸어요.")}
				{card("요즘 많이 본 글", "/community?sort=popular", data?.popular, "아직 글이 없어요. 첫 글을 남겨보세요.")}
			</HubGrid>
		</section>
	);
}
