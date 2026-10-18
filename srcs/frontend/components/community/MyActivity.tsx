'use client';

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { gql, POST_LIST_FIELDS } from "@/libs/graphql";
import { Chip, ChipRow, EmptyState, ErrorText, LinkButton } from "@/styles/styledUi";
import { PostList, PostListSkeleton } from "./PostList";
import type { Post } from "@/libs/types";

type Tab = "mine" | "listings" | "bookmarks";

const TABS: Tab[] = ["mine", "listings", "bookmarks"];

// MyActivity lists the member's own community posts (anonymous ones too,
// only they see them here) and the posts they saved.
export function MyActivity() {
	const t = useTranslations("community.activity");
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
			<ChipRow aria-label={t("label")} style={{ marginBottom: 12 }}>
				{TABS.map(key => (
					<Chip key={key} href="#activity" $active={tab === key} onClick={e => { e.preventDefault(); setTab(key); }} aria-pressed={tab === key}>
						{t(key)}
					</Chip>
				))}
			</ChipRow>
			{error && <ErrorText>{error}</ErrorText>}
			{posts === null && <PostListSkeleton count={3} />}
			{posts?.length === 0 && (
				<EmptyState>
					<p>{tab === "bookmarks" ? t("noBookmarks") : t("noPosts")}</p>
					{tab === "mine" && <LinkButton href="/community/write">{t("ask")}</LinkButton>}
					{tab === "listings" && <LinkButton href="/housing/write">{t("postRoom")}</LinkButton>}
				</EmptyState>
			)}
			{posts && posts.length > 0 && <PostList posts={posts} />}
		</div>
	);
}
