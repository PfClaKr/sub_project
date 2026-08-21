import { Metadata } from "next";
import { SellForm } from "@/components/form/SellForm";
import { PageTitle, SectionCard } from "@/styles/styledCommon";

export const metadata: Metadata = {
	title: "Sell",
};

export default function SellPage() {
	return (
		<div>
			<PageTitle>판매하기</PageTitle>
			<SectionCard>
				<SellForm />
			</SectionCard>
		</div>
	);
}
