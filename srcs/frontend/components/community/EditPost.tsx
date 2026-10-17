'use client';

import { useEffect, useState } from "react";
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
	const [post, setPost] = useState<Post | null | undefined>(undefined);

	useEffect(() => {
		gql<{ post: Post | null }>(`query($id: String!) { post(PostId: $id) { ${POST_DETAIL_FIELDS} } }`, { id: postId })
			.then(({ data }) => setPost(data?.post ?? null));
	}, [postId]);

	if (post === undefined) return <Skeleton $h="400px" />;
	if (!post || !post.IsMine) {
		return (
			<EmptyState>
				<p>내가 쓴 글만 수정할 수 있어요.</p>
				<LinkButton href={`/community/${postId}`}>글로 돌아가기</LinkButton>
			</EmptyState>
		);
	}
	return <PostForm post={post} />;
}
