'use client';

import { useEffect, useState } from "react";
import { gql, POST_LIST_FIELDS } from "@/libs/graphql";
import { Chip, ChipRow, EmptyState, ErrorText, LinkButton } from "@/styles/styledUi";
import { PostList, PostListSkeleton } from "./PostList";
import type { Post } from "@/libs/types";

type Tab = "mine" | "listings" | "bookmarks";

const TABS: { key: Tab; label: string }[] = [
	{ key: "mine", label: "내가 쓴 글" },
	{ key: "listings", label: "내 집·알바 글" },
	{ key: "bookmarks", label: "저장한 글" },
];

// MyActivity lists the member's own community posts (anonymous ones too,
// only they see them here) and the posts they saved.
export function MyActivity() {
	const [tab, setTab] = useState<Tab>("mine");
	const [posts, setPosts] = useState<Post[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		setPosts(null);
		const query = tab === "bookmarks"
			? `{ list: myBookmarks { ${POST_LIST_FIELDS} Deal } }`
			: `{ list: myPosts(Type: "${tab === "mine" ? "community" : "listing"}") { ${POST_LIST_FIELDS} Deal } }`;
		gql<{ list: Post[] }>(query).then(({ data, error }) => {
			if (error) setError(error);
			setPosts(data?.list ?? []);
		});
	}, [tab]);

	return (
		<div>
			<ChipRow aria-label="내 활동" style={{ marginBottom: 12 }}>
				{TABS.map(t => (
					<Chip key={t.key} href="#activity" $active={tab === t.key} onClick={e => { e.preventDefault(); setTab(t.key); }} aria-pressed={tab === t.key}>
						{t.label}
					</Chip>
				))}
			</ChipRow>
			{error && <ErrorText>{error}</ErrorText>}
			{posts === null && <PostListSkeleton count={3} />}
			{posts?.length === 0 && (
				<EmptyState>
					<p>{tab === "bookmarks" ? "저장한 글이 없어요. 글에서 '저장'을 누르면 여기에 모여요." : "아직 쓴 글이 없어요."}</p>
					{tab === "mine" && <LinkButton href="/community/write">질문하기</LinkButton>}
					{tab === "listings" && <LinkButton href="/housing/write">방 올리기</LinkButton>}
				</EmptyState>
			)}
			{posts && posts.length > 0 && <PostList posts={posts} />}
		</div>
	);
}
