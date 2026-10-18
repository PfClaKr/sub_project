import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { NotificationList } from "@/components/notification/NotificationList";
import { PageHeader } from "@/styles/styledLayout";
import { LinkButton } from "@/styles/styledUi";

export const generateMetadata = pageMetadata("pages.notifications");

export default async function Page() {
	const t = await getTranslations("notifications");
	return (
		<div>
			<PageHeader style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
				<h1>{t("title")}</h1>
				<LinkButton href="/myaccount/notifications" $ghost>{t("settings")}</LinkButton>
			</PageHeader>
			<NotificationList />
		</div>
	);
}
