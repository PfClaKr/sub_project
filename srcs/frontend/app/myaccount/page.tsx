import { Metadata } from "next";
import { MyAccount } from "@/components/account/MyAccount";

export const metadata: Metadata = {
	title: "My Account"
}

export default function MyAccountPage() {
	return (
		<div>
			<p>마이페이지</p>
			<MyAccount />
		</div>
	);
}
