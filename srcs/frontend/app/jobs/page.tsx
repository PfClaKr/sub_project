import { Metadata } from "next";
import { Suspense } from "react";
import { ListingBoard } from "@/components/listing/ListingBoard";
import { PostListSkeleton } from "@/components/community/PostList";

export const metadata: Metadata = {
	title: "알바·구인구직",
	description: "한인 가게 알바, 과외, 베이비시터 구인·구직 글을 모아봤어요.",
};

// useSearchParams in the board needs a Suspense boundary.
export default function Page() {
	return (
		<Suspense fallback={<PostListSkeleton />}>
			<ListingBoard type="job" />
		</Suspense>
	);
}
