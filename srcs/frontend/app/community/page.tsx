import { Suspense } from "react";
import { pageMetadata } from "@/libs/meta";
import { CommunityBoard } from "@/components/community/CommunityBoard";
import { PostListSkeleton } from "@/components/community/PostList";

export const generateMetadata = pageMetadata("pages.community");

// useSearchParams in the board needs a Suspense boundary.
export default function Page() {
	return (
		<Suspense fallback={<PostListSkeleton />}>
			<CommunityBoard />
		</Suspense>
	);
}
