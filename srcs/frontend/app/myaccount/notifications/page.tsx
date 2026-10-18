import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { NotificationSettings } from "@/components/notification/NotificationSettings";
import { PageHeader } from "@/styles/styledLayout";

export const generateMetadata = pageMetadata("pages.notifySettings");

export default async function Page() {
	return (
		<div>
			<PageHeader>
				<h1>{(await getTranslations("pages.notifySettings"))("title")}</h1>
				<p>{(await getTranslations("notifications"))("settingsLead")}</p>
			</PageHeader>
			<NotificationSettings />
		</div>
	);
}
