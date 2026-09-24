import { Metadata } from "next";
import { ChatRoomList } from "@/components/chat/ChatRoomList";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "채팅",
};

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>채팅</h1>
			</PageHeader>
			<ChatRoomList />
		</div>
	);
}
