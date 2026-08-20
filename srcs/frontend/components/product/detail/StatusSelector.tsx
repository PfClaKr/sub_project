'use client';

import { useEffect, useState } from "react";
import { GRAPHQL_URL, LOGIN_URL } from "@/libs/config";

const STATUSES = ["판매중", "예약중", "판매완료"];

type Props = {
	productId: string;
	ownerId: string;
	productStatus?: string;
};

// Shows a badge to visitors and a status selector to the owner.
export const StatusSelector = ({ productId, ownerId, productStatus }: Props) => {
	const [status, setStatus] = useState(productStatus ?? "판매중");
	const [isOwner, setIsOwner] = useState(false);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		fetch(`${LOGIN_URL}/whoami`, { credentials: 'include' })
			.then(res => res.ok ? res.json() : null)
			.then(session => setIsOwner(session?.UserId === ownerId))
			.catch(() => setIsOwner(false));
	}, [ownerId]);

	const handleChange = async (next: string) => {
		setBusy(true);
		try {
			const res = await fetch(GRAPHQL_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: `mutation U($productId: String!, $userId: String!, $status: String!) {
						updateProductStatus(ProductId: $productId, UserId: $userId, ProductStatus: $status) {
							ProductStatus
						}
					}`,
					variables: { productId, userId: ownerId, status: next },
				}),
			});
			const json = res.ok ? await res.json() : null;
			if (json?.data?.updateProductStatus?.ProductStatus) {
				setStatus(json.data.updateProductStatus.ProductStatus);
			}
		} finally {
			setBusy(false);
		}
	};

	if (!isOwner) return <p>상태: {status}</p>;

	return (
		<label>
			상태:{" "}
			<select value={status} disabled={busy} onChange={e => handleChange(e.target.value)}>
				{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
			</select>
		</label>
	);
};
