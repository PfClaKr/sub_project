'use client';

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormColumn, FieldLabel, ErrorText } from "@/styles/styledForm";
import { API_URL, GRAPHQL_URL, LOGIN_URL } from "@/libs/config";
import { CATEGORIES, REGIONS } from "@/libs/constants";

async function getSessionUserId(): Promise<string | null> {
	try {
		const res = await fetch(`${LOGIN_URL}/whoami`, { credentials: 'include' });
		if (!res.ok) return null;
		const json = await res.json();
		return json.UserId ?? null;
	} catch {
		return null;
	}
}

async function uploadImages(files: FileList): Promise<string[] | null> {
	const formData = new FormData();
	Array.from(files).forEach(file => formData.append("image", file));
	const res = await fetch(`${API_URL}/upload`, {
		method: 'POST',
		body: formData,
		credentials: 'include',
	});
	if (!res.ok) return null;
	const json = await res.json();
	return json.urls ?? [];
}

export const SellForm = () => {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		setSubmitting(true);
		try {
			const userId = await getSessionUserId();
			if (!userId) {
				router.push('/login');
				return;
			}

			const form = event.currentTarget;
			const formData = new FormData(form);
			const fileInput = form.elements.namedItem("images") as HTMLInputElement;

			let images: string[] = [];
			if (fileInput?.files && fileInput.files.length > 0) {
				const uploaded = await uploadImages(fileInput.files);
				if (uploaded === null) {
					setError("이미지 업로드에 실패했어요. 다시 시도해주세요.");
					return;
				}
				images = uploaded;
			}

			const res = await fetch(GRAPHQL_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: `mutation CreateProduct($userId: String!, $name: String!, $description: String!, $price: Float!, $category: String!, $images: [String!], $location: String!, $region: String) {
						createProduct(UserId: $userId, ProductName: $name, ProductDescription: $description, ProductPrice: $price, ProductCategory: $category, ProductImage: $images, PreferedLocation: $location, ProductRegion: $region) {
							ProductId
						}
					}`,
					variables: {
						userId,
						name: formData.get("name"),
						description: formData.get("description"),
						price: Number(formData.get("price")),
						category: formData.get("category"),
						images,
						location: formData.get("location"),
						region: formData.get("region"),
					},
				}),
			});
			const json = res.ok ? await res.json() : null;
			const productId = json?.data?.createProduct?.ProductId;
			if (!productId) {
				setError("상품 등록에 실패했어요. 다시 시도해주세요.");
				return;
			}
			router.push(`/product/${productId}`);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={handleSubmit}>
			<FieldLabel>상품명
				<input type="text" name="name" required maxLength={100} />
			</FieldLabel>
			<FieldLabel>설명
				<textarea name="description" required maxLength={2000} rows={5} />
			</FieldLabel>
			<FieldLabel>가격 (€)
				<input type="number" name="price" required min={0} step={0.01} />
			</FieldLabel>
			<FieldLabel>카테고리
				<select name="category" required>
					{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
				</select>
			</FieldLabel>
			<FieldLabel>지역
				<select name="region" required>
					{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
				</select>
			</FieldLabel>
			<FieldLabel>상세 거래 장소 (동네, 역 등)
				<input type="text" name="location" required maxLength={100} placeholder="예: 15구 Beaugrenelle" />
			</FieldLabel>
			<FieldLabel>사진 (최대 5장)
				<input type="file" name="images" accept="image/*" multiple />
			</FieldLabel>
			{error && <ErrorText>{error}</ErrorText>}
			<button type="submit" disabled={submitting}>
				{submitting ? "등록 중..." : "등록하기"}
			</button>
		</FormColumn>
	);
};
