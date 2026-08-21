import { Metadata } from "next";
import { EmptyState } from "@/styles/styledCommon";

export const metadata: Metadata = {
	title: "Offline",
};

export default function OfflinePage() {
	return (
		<EmptyState>
			<h1>인터넷 연결이 끊겼어요</h1>
			<p>연결을 확인한 뒤 다시 시도해주세요.</p>
		</EmptyState>
	);
}
