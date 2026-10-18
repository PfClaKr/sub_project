import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { WifiOff } from "lucide-react";
import { EmptyState } from "@/styles/styledUi";
import { PageHeader } from "@/styles/styledLayout";

export const generateMetadata = pageMetadata("offline");

// Served by the service worker (public/sw.js) when a page cannot load.
export default async function OfflinePage() {
	const t = await getTranslations("offline");
	return (
		<div>
			<PageHeader>
				<h1>{t("heading")}</h1>
			</PageHeader>
			<EmptyState>
				<WifiOff size={36} aria-hidden />
				<p>{t("body")}</p>
			</EmptyState>
		</div>
	);
}
