import { Metadata } from "next";
import { BlockList } from "@/components/chat/BlockList";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = { title: "차단한 사용자" };

export default function Page() {
	return (
		<div style={{ maxWidth: 640 }}>
			<PageHeader>
				<h1>차단한 사용자</h1>
				<p>차단한 사람과는 서로 메시지를 보낼 수 없고, 새 채팅도 시작할 수 없어요.</p>
			</PageHeader>
			<BlockList />
		</div>
	);
}
