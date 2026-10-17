import { Metadata } from "next";
import { Suspense } from "react";
import { CommunityBoard } from "@/components/community/CommunityBoard";
import { PostListSkeleton } from "@/components/community/PostList";

export const metadata: Metadata = {
	title: "커뮤니티",
	description: "파리 한인들이 생활 정보를 묻고 답하는 곳. 체류증, CAF, 은행, 학교, 의료 Q&A와 자유게시판.",
};

// useSearchParams in the board needs a Suspense boundary.
export default function Page() {
	return (
		<Suspense fallback={<PostListSkeleton />}>
			<CommunityBoard />
		</Suspense>
	);
}
