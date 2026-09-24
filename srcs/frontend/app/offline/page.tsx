import { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { EmptyState } from "@/styles/styledUi";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "오프라인",
};

// Served by the service worker (public/sw.js) when a page cannot load.
export default function OfflinePage() {
	return (
		<div>
			<PageHeader>
				<h1>인터넷 연결이 끊겼어요</h1>
			</PageHeader>
			<EmptyState>
				<WifiOff size={36} aria-hidden />
				<p>연결을 확인한 뒤 다시 시도해주세요.</p>
			</EmptyState>
		</div>
	);
}
