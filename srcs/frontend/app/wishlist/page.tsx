import { Metadata } from "next";
import { FavoriteList } from "@/components/product/FavoriteList";
import { PageTitle } from "@/styles/styledCommon";

export const metadata: Metadata = {
	title: "WishList"
}

export default function WishListPage() {
	return (
		<div>
			<PageTitle>찜 목록</PageTitle>
			<FavoriteList />
		</div>
	);
}
