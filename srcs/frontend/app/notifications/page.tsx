import { Metadata } from "next";
import { NotificationList } from "@/components/notification/NotificationList";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "알림",
};

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>알림</h1>
			</PageHeader>
			<NotificationList />
		</div>
	);
}
