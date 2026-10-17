import { Metadata } from "next";
import { NewListing } from "@/components/listing/ListingForm";
import { PageHeader } from "@/styles/styledLayout";
import { WriteLayout } from "@/components/form/WriteLayout";

export const metadata: Metadata = { title: "알바·구인구직 글쓰기" };

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>알바·구인구직 글쓰기</h1>
			</PageHeader>
			<WriteLayout kind="job"><NewListing type="job" /></WriteLayout>
		</div>
	);
}
