import { Metadata } from "next";
import { Suspense } from "react";
import { Unsubscribe } from "@/components/notification/Unsubscribe";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = { title: "이메일 알림 끄기", robots: { index: false } };

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>이메일 알림 끄기</h1>
			</PageHeader>
			<Suspense>
				<Unsubscribe />
			</Suspense>
		</div>
	);
}
