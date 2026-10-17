'use client';

import { ProductForm } from "@/components/form/ProductForm";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { PageHeader } from "@/styles/styledLayout";
import { WriteLayout } from "@/components/form/WriteLayout";

export default function SellPage() {
	return (
		<div>
			<PageHeader>
				<h1>판매하기</h1>
				<p>사진과 설명을 자세히 적을수록 빨리 팔려요.</p>
			</PageHeader>
			<WriteLayout kind="product"><RequireLogin>{() => <ProductForm />}</RequireLogin></WriteLayout>
		</div>
	);
}
