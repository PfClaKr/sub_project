import { Metadata } from "next";
import { EditPost } from "@/components/community/EditPost";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = { title: "글 수정" };

export default function Page({ params }: { params: { postId: string } }) {
	return (
		<div>
			<PageHeader>
				<h1>글 수정</h1>
			</PageHeader>
			<EditPost postId={params.postId} />
		</div>
	);
}
