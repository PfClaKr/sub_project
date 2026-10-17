import { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: "집",
};

export default function Page() {
	return (
		<div>
			<PageHeader>
				<h1>집</h1>
			</PageHeader>
			<ComingSoon section="housing" />
		</div>
	);
}
