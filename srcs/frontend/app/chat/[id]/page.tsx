import { Metadata } from "next";
import { ChatRoom } from "@/components/chat/ChatRoom";

export const metadata: Metadata = {
	title: "Chat Room"
}

export default function ChatRoomPage({params: {id}}: {params: {id: string}; }) {
	return (
		<div>
			<p>채팅방</p>
			<ChatRoom chatId={id} />
		</div>
	);
}
