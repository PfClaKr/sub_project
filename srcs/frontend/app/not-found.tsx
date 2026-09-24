import { Metadata } from "next";
import { EmptyState, LinkButton } from "@/styles/styledUi";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "페이지를 찾을 수 없어요",
};

export default function NotFound() {
	return (
		<div>
			<PageHeader>
				<h1>페이지를 찾을 수 없어요</h1>
			</PageHeader>
			<EmptyState>
				<p>삭제되었거나 주소가 잘못된 것 같아요.</p>
				<LinkButton href="/">홈으로</LinkButton>
			</EmptyState>
		</div>
	);
}
