'use client';

import { useState } from "react";
import { gql } from "@/libs/graphql";
import { STATUSES } from "@/libs/constants";
import { FieldLabel } from "@/styles/styledForm";
import { ErrorText } from "@/styles/styledUi";
import { useLocale, useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";

// Owner-only control; the server checks ownership again.
export const StatusSelector = ({ productId, initial, onChange }: {
	productId: string;
	initial: string;
	onChange?: (status: string) => void;
}) => {
	const t = useTranslations("product");
	const L = useLabels();
	const [status, setStatus] = useState(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const handleChange = async (next: string) => {
		setBusy(true);
		setError("");
		const { data, error } = await gql<{ updateProductStatus: { ProductStatus: string } }>(
			`mutation U($productId: String!, $status: String!) {
				updateProductStatus(ProductId: $productId, ProductStatus: $status) { ProductStatus }
			}`,
			{ productId, status: next },
		);
		setBusy(false);
		if (error || !data?.updateProductStatus) {
			setError(error ?? t("statusError"));
			return;
		}
		setStatus(data.updateProductStatus.ProductStatus);
		onChange?.(data.updateProductStatus.ProductStatus);
	};

	return (
		<FieldLabel>
			{t("status")}
			<select value={status} disabled={busy} onChange={e => handleChange(e.target.value)}>
				{STATUSES.map(s => <option key={s} value={s}>{L.enum("status", s)}</option>)}
			</select>
			{error && <ErrorText>{error}</ErrorText>}
		</FieldLabel>
	);
};
