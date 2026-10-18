'use client';

import { ProductForm } from "@/components/form/ProductForm";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { PageHeader } from "@/styles/styledLayout";
import { WriteLayout } from "@/components/form/WriteLayout";
import { useTranslations } from "next-intl";

export default function SellPage() {
	const t = useTranslations("productForm");
	return (
		<div>
			<PageHeader>
				<h1>{t("sellTitle")}</h1>
				<p>{t("sellLead")}</p>
			</PageHeader>
			<WriteLayout kind="product"><RequireLogin>{() => <ProductForm />}</RequireLogin></WriteLayout>
		</div>
	);
}
