import { Metadata } from "next";
import { NotificationList } from "@/components/notification/NotificationList";
import { PageHeader } from "@/styles/styledLayout";
import { LinkButton } from "@/styles/styledUi";

export const metadata: Metadata = {
	title: "알림",
};

export default function Page() {
	return (
		<div>
			<PageHeader style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
				<h1>알림</h1>
				<LinkButton href="/myaccount/notifications" $ghost>알림 설정</LinkButton>
			</PageHeader>
			<NotificationList />
		</div>
	);
}
