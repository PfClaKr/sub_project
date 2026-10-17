import { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "커뮤니티",
};

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>커뮤니티</h1>
			</PageHeader>
			<ComingSoon section="community" />
		</div>
	);
}
