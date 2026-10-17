'use client';

import { useEffect, useState } from "react";
import { gql, POST_LIST_FIELDS } from "@/libs/graphql";
import { Chip, ChipRow, EmptyState, ErrorText, LinkButton } from "@/styles/styledUi";
import { PostList, PostListSkeleton } from "./PostList";
import type { Post } from "@/libs/types";

type Tab = "mine" | "bookmarks";

// MyActivity lists the member's own community posts (anonymous ones too,
// only they see them here) and the posts they saved.
export function MyActivity() {
	const [tab, setTab] = useState<Tab>("mine");
	const [posts, setPosts] = useState<Post[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		setPosts(null);
		const query = tab === "mine"
			? `{ myPosts { ${POST_LIST_FIELDS} } }`
			: `{ myBookmarks { ${POST_LIST_FIELDS} } }`;
		gql<{ myPosts?: Post[]; myBookmarks?: Post[] }>(query).then(({ data, error }) => {
			if (error) setError(error);
			setPosts((tab === "mine" ? data?.myPosts : data?.myBookmarks) ?? []);
		});
	}, [tab]);

	return (
		<div>
			<ChipRow aria-label="내 활동" style={{ marginBottom: 12 }}>
				{(["mine", "bookmarks"] as Tab[]).map(t => (
					<Chip key={t} href="#activity" $active={tab === t} onClick={e => { e.preventDefault(); setTab(t); }} aria-pressed={tab === t}>
						{t === "mine" ? "내가 쓴 글" : "저장한 글"}
					</Chip>
				))}
			</ChipRow>
			{error && <ErrorText>{error}</ErrorText>}
			{posts === null && <PostListSkeleton count={3} />}
			{posts?.length === 0 && (
				<EmptyState>
					<p>{tab === "mine" ? "아직 쓴 글이 없어요." : "저장한 글이 없어요. 글에서 '저장'을 누르면 여기에 모여요."}</p>
					{tab === "mine" && <LinkButton href="/community/write">질문하기</LinkButton>}
				</EmptyState>
			)}
			{posts && posts.length > 0 && <PostList posts={posts} />}
		</div>
	);
}
