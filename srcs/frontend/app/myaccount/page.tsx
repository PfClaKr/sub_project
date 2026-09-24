import { Metadata } from "next";
import { MyAccount } from "@/components/account/MyAccount";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "마이페이지",
};

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>마이페이지</h1>
			</PageHeader>
			<MyAccount />
		</div>
	);
}
