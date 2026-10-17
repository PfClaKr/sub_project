import { Metadata } from "next";
import { Suspense } from "react";
import { ListingBoard } from "@/components/listing/ListingBoard";
import { PostListSkeleton } from "@/components/community/PostList";

export const metadata: Metadata = {
	title: "집 구하기",
	description: "파리와 프랑스의 쉐어, 원룸, 서블렛을 조건과 지도로 찾아보세요.",
};

// useSearchParams in the board needs a Suspense boundary.
export default function Page() {
	return (
		<Suspense fallback={<PostListSkeleton />}>
			<ListingBoard type="housing" />
		</Suspense>
	);
}
