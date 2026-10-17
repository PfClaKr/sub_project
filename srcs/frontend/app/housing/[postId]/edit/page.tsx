import { Metadata } from "next";
import { EditListing } from "@/components/listing/EditListing";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = { title: "글 수정" };

export default function Page({ params }: { params: { postId: string } }) {
	return (
		<div>
			<PageHeader>
				<h1>글 수정</h1>
			</PageHeader>
			<EditListing type="housing" postId={params.postId} />
		</div>
	);
}
