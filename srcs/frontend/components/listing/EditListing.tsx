'use client';

import { useEffect, useState } from "react";
import { gql, LISTING_DETAIL_FIELDS } from "@/libs/graphql";
import { LISTING_PATH } from "@/libs/listing";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { EmptyState, LinkButton, Skeleton } from "@/styles/styledUi";
import { ListingForm } from "./ListingForm";
import type { ListingType } from "@/libs/constants";
import type { Post } from "@/libs/types";

export function EditListing({ type, postId }: { type: ListingType; postId: string }) {
	return <RequireLogin>{() => <EditForm type={type} postId={postId} />}</RequireLogin>;
}

function EditForm({ type, postId }: { type: ListingType; postId: string }) {
	const [post, setPost] = useState<Post | null | undefined>(undefined);
	useEffect(() => {
		gql<{ listing: Post | null }>(`query($id: String!) { listing(PostId: $id) { ${LISTING_DETAIL_FIELDS} } }`, { id: postId })
			.then(({ data }) => setPost(data?.listing ?? null));
	}, [postId]);

	if (post === undefined) return <Skeleton $h="400px" />;
	if (!post || !post.IsMine || post.Type !== type) {
		return (
			<EmptyState>
				<p>내가 쓴 글만 수정할 수 있어요.</p>
				<LinkButton href={`${LISTING_PATH[type]}/${postId}`}>글로 돌아가기</LinkButton>
			</EmptyState>
		);
	}
	return <ListingForm type={type} post={post} />;
}
