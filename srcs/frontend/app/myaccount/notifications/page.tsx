import { Metadata } from "next";
import { NotificationSettings } from "@/components/notification/NotificationSettings";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = { title: "알림 설정" };

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>알림 설정</h1>
				<p>어떤 알림을 이메일과 푸시로 받을지 골라주세요.</p>
			</PageHeader>
			<NotificationSettings />
		</div>
	);
}
