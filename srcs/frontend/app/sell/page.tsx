import { Metadata } from "next";
import { SellForm } from "@/components/form/SellForm";

export const metadata: Metadata = {
	title: "Sell",
};

export default function SellPage() {
	return (
		<div>
			<p>판매하기</p>
			<p>Home &gt; Pages &gt; Sell</p>
			<SellForm />
		</div>
	);
}
