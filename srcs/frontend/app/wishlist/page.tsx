import { Metadata } from "next";
import { FavoriteList } from "@/components/product/FavoriteList";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "찜 목록",
};

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>찜 목록</h1>
			</PageHeader>
			<FavoriteList />
		</div>
	);
}
