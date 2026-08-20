import { Metadata } from "next";
import { FavoriteList } from "@/components/product/FavoriteList";

export const metadata: Metadata = {
	title: "WishList"
}

export default function WishListPage() {
	return (
		<div>
			<p>찜 목록</p>
			<FavoriteList />
		</div>
	);
}
