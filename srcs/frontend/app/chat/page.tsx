import { Metadata } from "next";
import { ChatRoomList } from "@/components/chat/ChatRoomList";
import { PageTitle } from "@/styles/styledCommon";

export const metadata: Metadata = {
	title: "Chat"
}

export default function ChatPage() {
	return (
		<div>
			<PageTitle>내 채팅</PageTitle>
			<ChatRoomList />
		</div>
	);
}
