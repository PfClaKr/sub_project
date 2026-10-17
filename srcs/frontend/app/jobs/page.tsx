import { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "알바",
};

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>알바</h1>
			</PageHeader>
			<ComingSoon section="jobs" />
		</div>
	);
}
