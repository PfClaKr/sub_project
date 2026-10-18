'use client';

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { gql, POST_DETAIL_FIELDS } from "@/libs/graphql";
import { EmptyState, LinkButton, Skeleton } from "@/styles/styledUi";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { PostForm } from "./PostForm";
import type { Post } from "@/libs/types";

// EditPost loads the post with the session cookie and only offers the
// form to its author.
export function EditPost({ postId }: { postId: string }) {
	return <RequireLogin>{() => <EditForm postId={postId} />}</RequireLogin>;
}

function EditForm({ postId }: { postId: string }) {
	const t = useTranslations("community.post");
	const [post, setPost] = useState<Post | null | undefined>(undefined);

	useEffect(() => {
		gql<{ post: Post | null }>(`query($id: String!) { post(PostId: $id) { ${POST_DETAIL_FIELDS} } }`, { id: postId })
			.then(({ data }) => setPost(data?.post ?? null));
	}, [postId]);

	if (post === undefined) return <Skeleton $h="400px" />;
	if (!post || !post.IsMine) {
		return (
			<EmptyState>
				<p>{t("onlyMine")}</p>
				<LinkButton href={`/community/${postId}`}>{t("backToPost")}</LinkButton>
			</EmptyState>
		);
	}
	return <PostForm post={post} />;
}
