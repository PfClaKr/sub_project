import { Metadata } from "next";

export const metadata: Metadata = {
	title: "My Account"
}

export default function MyAccountPage() {
	return (
		<div>
			<p>My Account</p>
			<p>Home &gt; Pages &gt; My Account</p>
		</div>
	);
}
