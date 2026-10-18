import { cache } from "react";
import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ListingDetail } from "@/components/listing/ListingDetail";
import { gql, LISTING_DETAIL_FIELDS } from "@/libs/graphql";
import type { Post } from "@/libs/types";

type Props = { params: { postId: string } };

// Public read for metadata and the first paint; the client re-reads it
// with the session cookie.
const getListing = cache(async (postId: string) => {
	const { data } = await gql<{ listing: Post | null }>(
		`query Listing($id: String!) { listing(PostId: $id) { ${LISTING_DETAIL_FIELDS} } }`,
		{ id: postId },
	);
	return data?.listing?.Type === "job" ? data.listing : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const post = await getListing(params.postId);
	if (!post) return { title: (await getTranslations("pages.notFound"))("title") };
	return { title: post.Title, description: post.Body?.slice(0, 120) };
}

export default async function Page({ params }: Props) {
	const post = await getListing(params.postId);
	return <ListingDetail type="job" postId={params.postId} initial={post} />;
}
