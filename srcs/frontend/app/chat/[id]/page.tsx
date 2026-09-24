import { Metadata } from "next";
import Link from "next/link";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { Breadcrumb } from "@/styles/styledDetail";

export const metadata: Metadata = {
	title: "채팅방",
};

export default function ChatRoomPage({ params }: { params: { id: string } }) {
	return (
		<div>
			<Breadcrumb>
				<Link href="/chat">← 채팅 목록</Link>
			</Breadcrumb>
			<ChatRoom chatId={params.id} />
		</div>
	);
}
