import { Metadata } from "next";
import { NewListing } from "@/components/listing/ListingForm";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = { title: "집 구하기 글쓰기" };

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>집 구하기 글쓰기</h1>
			</PageHeader>
			<NewListing type="housing" />
		</div>
	);
}
