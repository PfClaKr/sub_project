'use client';

import { useState } from "react";
import { gql } from "@/libs/graphql";
import { STATUSES } from "@/libs/constants";
import { FieldLabel } from "@/styles/styledForm";
import { ErrorText } from "@/styles/styledUi";

// Owner-only control; the server checks ownership again.
export const StatusSelector = ({ productId, initial, onChange }: {
	productId: string;
	initial: string;
	onChange?: (status: string) => void;
}) => {
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
			setError(error ?? "상태를 바꾸지 못했어요.");
			return;
		}
		setStatus(data.updateProductStatus.ProductStatus);
		onChange?.(data.updateProductStatus.ProductStatus);
	};

	return (
		<FieldLabel>
			판매 상태
			<select value={status} disabled={busy} onChange={e => handleChange(e.target.value)}>
				{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
			</select>
			{error && <ErrorText>{error}</ErrorText>}
		</FieldLabel>
	);
};
