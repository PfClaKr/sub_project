import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { NewListing } from "@/components/listing/ListingForm";
import { PageHeader } from "@/styles/styledLayout";
import { WriteLayout } from "@/components/form/WriteLayout";

export const generateMetadata = pageMetadata("pages.writeHousing");

export default async function Page() {
	return (
		<div>
			<PageHeader>
				<h1>{(await getTranslations("pages.writeHousing"))("title")}</h1>
			</PageHeader>
			<WriteLayout kind="housing"><NewListing type="housing" /></WriteLayout>
		</div>
	);
}
