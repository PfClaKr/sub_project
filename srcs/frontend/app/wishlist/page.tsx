import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { FavoriteList } from "@/components/product/FavoriteList";
import { PageHeader } from "@/styles/styledLayout";

export const generateMetadata = pageMetadata("pages.wishlist");

export default async function Page() {
	const t = await getTranslations("pages.wishlist");
	return (
		<div>
			<PageHeader>
				<h1>{t("title")}</h1>
			</PageHeader>
			<FavoriteList />
		</div>
	);
}
