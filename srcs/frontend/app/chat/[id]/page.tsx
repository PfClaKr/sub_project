import { Metadata } from "next";
import { ChatRoom } from "@/components/chat/ChatRoom";
import { PageTitle } from "@/styles/styledCommon";

export const metadata: Metadata = {
	title: "Chat Room"
}

export default function ChatRoomPage({params: {id}}: {params: {id: string}; }) {
	return (
		<div>
			<PageTitle>채팅방</PageTitle>
			<ChatRoom chatId={id} />
		</div>
	);
}
