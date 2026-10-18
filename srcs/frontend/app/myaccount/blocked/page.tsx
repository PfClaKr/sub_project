import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { BlockList } from "@/components/chat/BlockList";
import { PageHeader } from "@/styles/styledLayout";

export const generateMetadata = pageMetadata("pages.blocked");

export default async function Page() {
	return (
		<div style={{ maxWidth: 640 }}>
			<PageHeader>
				<h1>{(await getTranslations("pages.blocked"))("title")}</h1>
				<p>{(await getTranslations("pages.blocked"))("lead")}</p>
			</PageHeader>
			<BlockList />
		</div>
	);
}
