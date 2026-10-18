import { cache } from "react";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PostDetail } from "@/components/community/PostDetail";
import { gql, POST_DETAIL_FIELDS } from "@/libs/graphql";
import type { Post } from "@/libs/types";

type Props = { params: { postId: string } };

// Server-side read without the session cookie: public fields only, which
// is what search engines and link previews should see.
const getPost = cache(async (postId: string) => {
	const { data } = await gql<{ post: Post | null }>(
		`query Post($id: String!) { post(PostId: $id) { ${POST_DETAIL_FIELDS} } }`,
		{ id: postId },
	);
	return data?.post ?? null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const post = await getPost(params.postId);
	if (!post) return { title: (await getTranslations("pages.notFound"))("title") };
	return { title: post.Title, description: post.BodyPreview };
}

// A hidden post is only visible to its author, which the server cannot
// tell without the cookie, so a missing post is left to the client.
export default async function Page({ params }: Props) {
	const post = await getPost(params.postId);
	return <PostDetail postId={params.postId} initial={post} />;
}
