import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { NewListing } from "@/components/listing/ListingForm";
import { PageHeader } from "@/styles/styledLayout";
import { WriteLayout } from "@/components/form/WriteLayout";

export const generateMetadata = pageMetadata("pages.writeJob");

export default async function Page() {
	return (
		<div>
			<PageHeader>
				<h1>{(await getTranslations("pages.writeJob"))("title")}</h1>
			</PageHeader>
			<WriteLayout kind="job"><NewListing type="job" /></WriteLayout>
		</div>
	);
}
