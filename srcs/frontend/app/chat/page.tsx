import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import Link from "next/link";
import { ChatRoomList } from "@/components/chat/ChatRoomList";
import { PageHeader } from "@/styles/styledLayout";

export const generateMetadata = pageMetadata("pages.chat");

export default async function Page() {
	const t = await getTranslations("chat");
	return (
		<div>
			<PageHeader style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
				<h1>{t("title")}</h1>
				<Link href="/myaccount/blocked" style={{ fontSize: 14 }}>{t("blockedList")}</Link>
			</PageHeader>
			<ChatRoomList />
		</div>
	);
}
