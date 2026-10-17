import { Metadata } from "next";
import Link from "next/link";
import { ChatRoomList } from "@/components/chat/ChatRoomList";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "채팅",
};

export default function Page() {
	return (
		<div>
			<PageHeader style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
				<h1>채팅</h1>
				<Link href="/myaccount/blocked" style={{ fontSize: 14 }}>차단 목록</Link>
			</PageHeader>
			<ChatRoomList />
		</div>
	);
}
