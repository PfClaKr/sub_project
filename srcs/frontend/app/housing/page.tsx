import { Suspense } from "react";
import { pageMetadata } from "@/libs/meta";
import { ListingBoard } from "@/components/listing/ListingBoard";
import { PostListSkeleton } from "@/components/community/PostList";

export const generateMetadata = pageMetadata("pages.housing");

// useSearchParams in the board needs a Suspense boundary.
export default function Page() {
	return (
		<Suspense fallback={<PostListSkeleton />}>
			<ListingBoard type="housing" />
		</Suspense>
	);
}
