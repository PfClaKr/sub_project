import { Metadata } from "next";
import { MyAccount } from "@/components/account/MyAccount";
import { PageTitle } from "@/styles/styledCommon";

export const metadata: Metadata = {
	title: "My Account"
}

export default function MyAccountPage() {
	return (
		<div>
			<PageTitle>마이페이지</PageTitle>
			<MyAccount />
		</div>
	);
}
