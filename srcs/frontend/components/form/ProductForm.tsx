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
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";

const FIELDS = `$name: String!, $description: String!, $price: Float!, $category: String!, $images: [String!], $location: String!, $region: String, $lat: Float, $lng: Float, $exact: Boolean`;
const ARGS = `ProductName: $name, ProductDescription: $description, ProductPrice: $price, ProductCategory: $category, ProductImage: $images, PreferedLocation: $location, ProductRegion: $region, Latitude: $lat, Longitude: $lng, ExactLocation: $exact`;

// ProductForm creates a product, or edits one when `product` is given.
export const ProductForm = ({ product }: { product?: Product }) => {
	const t = useTranslations("productForm");
	const c = useTranslations("common");
	const L = useLabels();
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
			setError(t("pickPlace"));
			return;
		}
		if (!location.exact && !location.area && !location.areaId) {
			setError(t("noArea"));
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
				setError(error ?? c("saveError"));
				return;
			}
			router.push(`/product/${data.ProductId}`);
			router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : c("saveError"));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={handleSubmit} style={{ maxWidth: 680 }}>
			<FormSection aria-labelledby="sec-photos">
				<header>
					<h2 id="sec-photos">{t("photos")}</h2>
					<p>{t("photosTip")}</p>
				</header>
				<ImageUploader photos={photos} onChange={setPhotos} uploading={submitting} />
			</FormSection>

			<FormSection aria-labelledby="sec-basic">
				<header><h2 id="sec-basic">{t("basics")}</h2></header>
				<FieldLabel>{t("name")}
					<input type="text" name="name" required maxLength={100} placeholder={t("namePlaceholder")} defaultValue={product?.ProductName} />
				</FieldLabel>
				<TwoColumns>
					<FieldLabel>{t("price")}
						<Adorned>
							<span aria-hidden>€</span>
							<input type="number" name="price" required min={0} max={1000000} step={0.01} inputMode="decimal" placeholder="0" defaultValue={product?.ProductPrice} />
						</Adorned>
					</FieldLabel>
					<FieldLabel>{t("category")}
						<select name="category" required defaultValue={product?.ProductCategory ?? ""}>
							<option value="" disabled>{c("choose")}</option>
							{CATEGORIES.map(cat => <option key={cat} value={cat}>{L.enum("category", cat)}</option>)}
						</select>
					</FieldLabel>
				</TwoColumns>
			</FormSection>

			<FormSection aria-labelledby="sec-location">
				<header><h2 id="sec-location">{t("location")}</h2></header>
				<FieldLabel>{c("region")} <Hint>{t("regionHint")}</Hint>
					<select name="region" required defaultValue={product?.ProductRegion ?? DEFAULT_REGION}>
						{REGIONS.map(r => <option key={r} value={r}>{L.enum("region", r)}</option>)}
					</select>
				</FieldLabel>
				<LocationField value={location} onChange={setLocation} />
			</FormSection>

			<FormSection aria-labelledby="sec-desc">
				<header><h2 id="sec-desc">{t("description")}</h2></header>
				<FieldLabel>
					<span className="sr-only">{t("description")}</span>
					<textarea
						required
						maxLength={2000}
						rows={7}
						placeholder={t("descriptionPlaceholder")}
						value={description}
						onChange={e => setDescription(e.target.value)}
					/>
					<Counter>{description.length.toLocaleString()} / {(2000).toLocaleString()}</Counter>
				</FieldLabel>
			</FormSection>

			{error && <ErrorText role="alert">{error}</ErrorText>}
			<SubmitButton type="submit" disabled={submitting}>
				{submitting ? c("saving") : product ? t("update") : t("submit")}
			</SubmitButton>
		</FormColumn>
	);
};
