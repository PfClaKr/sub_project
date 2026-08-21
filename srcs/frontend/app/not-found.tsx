import { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/styles/styledCommon";

export const metadata: Metadata = {
	title: "Not Found",
};

export default function NotFound() {
	return (
		<EmptyState>
			<h1>페이지를 찾을 수 없어요</h1>
			<p>삭제됐거나 주소가 잘못된 것 같아요.</p>
			<Link href="/">홈으로 돌아가기</Link>
		</EmptyState>
	);
}
