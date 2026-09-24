'use client';

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Adorned, Counter, FieldLabel, FormColumn, FormSection, Hint, SubmitButton, TwoColumns } from "@/styles/styledForm";
import { ErrorText } from "@/styles/styledUi";
import { CATEGORIES, DEFAULT_REGION, REGIONS } from "@/libs/constants";
import { gql } from "@/libs/graphql";
import { uploadImages } from "@/libs/upload";
import type { Product } from "@/libs/types";
import { LocationField, type LocationState } from "./LocationField";
import { ImageUploader, photoFromUrl, type Photo } from "./ImageUploader";

const FIELDS = `$name: String!, $description: String!, $price: Float!, $category: String!, $images: [String!], $location: String!, $region: String, $lat: Float, $lng: Float, $exact: Boolean`;
const ARGS = `ProductName: $name, ProductDescription: $description, ProductPrice: $price, ProductCategory: $category, ProductImage: $images, PreferedLocation: $location, ProductRegion: $region, Latitude: $lat, Longitude: $lng, ExactLocation: $exact`;

// ProductForm creates a product, or edits one when `product` is given.
export const ProductForm = ({ product }: { product?: Product }) => {
	const router = useRouter();
	const [photos, setPhotos] = useState<Photo[]>(() => (product?.ProductImage ?? []).map(photoFromUrl));
	const [description, setDescription] = useState(product?.ProductDescription ?? "");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [location, setLocation] = useState<LocationState>(() => ({
		label: product?.PreferedLocation ?? "",
		point: product?.Latitude != null && product?.Longitude != null
			? { lat: product.Latitude, lng: product.Longitude }
			: null,
		exact: !!product?.ExactLocation,
		area: null,
		areaId: product?.AreaId ?? undefined,
	}));

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		if (!location.point) {
			setError("지도에서 거래 희망 위치를 골라주세요.");
			return;
		}
		if (!location.exact && !location.area && !location.areaId) {
			setError("동네를 확인하지 못했어요. 다른 위치를 고르거나 정확한 위치로 표시해주세요.");
			return;
		}
		setSubmitting(true);
		try {
			const form = new FormData(event.currentTarget);
			// New files upload in order; the result replaces them in place so
			// the order chosen in the uploader (cover first) is kept.
			const uploaded = await uploadImages(photos.flatMap(p => (p.file ? [p.file] : [])));
			let next = 0;
			const images = photos.map(p => (p.file ? uploaded[next++] : p.url));
			const variables = {
				name: form.get("name"),
				description,
				price: Number(form.get("price")),
				category: form.get("category"),
				region: form.get("region"),
				images,
				location: location.label,
				lat: location.point.lat,
				lng: location.point.lng,
				exact: location.exact,
				productId: product?.ProductId,
			};

			const { data, error } = product
				? await gql<{ updateProduct: { ProductId: string } }>(
					`mutation Update($productId: String!, ${FIELDS}) { updateProduct(ProductId: $productId, ${ARGS}) { ProductId } }`,
					variables,
				).then(r => ({ data: r.data?.updateProduct, error: r.error }))
				: await gql<{ createProduct: { ProductId: string } }>(
					`mutation Create(${FIELDS}) { createProduct(${ARGS}) { ProductId } }`,
					variables,
				).then(r => ({ data: r.data?.createProduct, error: r.error }));

			if (!data?.ProductId) {
				setError(error ?? "저장하지 못했어요. 다시 시도해주세요.");
				return;
			}
			router.push(`/product/${data.ProductId}`);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "저장하지 못했어요.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={handleSubmit} style={{ maxWidth: 680 }}>
			<FormSection aria-labelledby="sec-photos">
				<header>
					<h2 id="sec-photos">사진</h2>
					<p>첫 번째 사진이 목록에 보이는 대표 사진이에요.</p>
				</header>
				<ImageUploader photos={photos} onChange={setPhotos} uploading={submitting} />
			</FormSection>

			<FormSection aria-labelledby="sec-basic">
				<header><h2 id="sec-basic">기본 정보</h2></header>
				<FieldLabel>상품명
					<input type="text" name="name" required maxLength={100} placeholder="예: 이케아 원목 책상" defaultValue={product?.ProductName} />
				</FieldLabel>
				<TwoColumns>
					<FieldLabel>가격
						<Adorned>
							<span aria-hidden>€</span>
							<input type="number" name="price" required min={0} max={1000000} step={0.01} inputMode="decimal" placeholder="0" defaultValue={product?.ProductPrice} />
						</Adorned>
					</FieldLabel>
					<FieldLabel>카테고리
						<select name="category" required defaultValue={product?.ProductCategory ?? ""}>
							<option value="" disabled>선택해주세요</option>
							{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
						</select>
					</FieldLabel>
				</TwoColumns>
			</FormSection>

			<FormSection aria-labelledby="sec-location">
				<header><h2 id="sec-location">거래 위치</h2></header>
				<FieldLabel>지역 <Hint>검색 필터에 쓰여요</Hint>
					<select name="region" required defaultValue={product?.ProductRegion ?? DEFAULT_REGION}>
						{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
					</select>
				</FieldLabel>
				<LocationField value={location} onChange={setLocation} />
			</FormSection>

			<FormSection aria-labelledby="sec-desc">
				<header><h2 id="sec-desc">설명</h2></header>
				<FieldLabel>
					<span className="sr-only">설명</span>
					<textarea
						required
						maxLength={2000}
						rows={7}
						placeholder={"상품 상태, 구매 시기, 하자 여부 등을 적어주세요.\n예) 1년 사용, 모서리에 작은 긁힘 있어요."}
						value={description}
						onChange={e => setDescription(e.target.value)}
					/>
					<Counter>{description.length.toLocaleString()} / 2,000</Counter>
				</FieldLabel>
			</FormSection>

			{error && <ErrorText role="alert">{error}</ErrorText>}
			<SubmitButton type="submit" disabled={submitting}>
				{submitting ? "저장 중..." : product ? "수정 완료" : "등록하기"}
			</SubmitButton>
		</FormColumn>
	);
};
