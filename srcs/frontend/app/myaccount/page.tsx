import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { MyAccount } from "@/components/account/MyAccount";
import { PageHeader } from "@/styles/styledLayout";

export const generateMetadata = pageMetadata("pages.myaccount");

export default async function Page() {
	return (
		<div>
			<PageHeader>
				<h1>{(await getTranslations("pages.myaccount"))("title")}</h1>
			</PageHeader>
			<MyAccount />
		</div>
	);
}
