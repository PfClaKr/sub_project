import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import Link from "next/link";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { Breadcrumb } from "@/styles/styledDetail";

export const generateMetadata = pageMetadata("pages.chatRoom");

export default async function ChatRoomPage({ params }: { params: { id: string } }) {
	const t = await getTranslations("chat");
	return (
		<div>
			<Breadcrumb>
				<Link href="/chat">{t("back")}</Link>
			</Breadcrumb>
			<ChatRoom chatId={params.id} />
		</div>
	);
}
