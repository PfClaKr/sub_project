import { Metadata } from "next";
import { ChatRoomList } from "@/components/chat/ChatRoomList";

export const metadata: Metadata = {
	title: "Chat"
}

export default function ChatPage() {
	return (
		<div>
			<p>내 채팅</p>
			<ChatRoomList />
		</div>
	);
}
