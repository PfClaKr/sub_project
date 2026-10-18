import { cache } from "react";
import { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getLabels } from "@/libs/labels.server";
import type { Locale } from "@/i18n/config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageGallery } from "@/components/product/detail/ImageGallery";
import { ProductActions } from "@/components/product/detail/ProductActions";
import { SellerCard } from "@/components/product/detail/SellerCard";
import { LocationPreview } from "@/components/product/detail/LocationPreview";
import { Breadcrumb, DetailLayout, InfoPanel, BigPrice, Facts, Description } from "@/styles/styledDetail";
import { ErrorText } from "@/styles/styledUi";
import { gql } from "@/libs/graphql";
import { formatPrice } from "@/libs/format";
import { STATUS_SELLING } from "@/libs/constants";
import type { Product, User } from "@/libs/types";
import { TimeAgo } from "@/components/ui/TimeAgo";

type Props = { params: { id: string } };

const getProduct = cache(async (productId: string) => {
	return gql<{ product: Product | null; }>(
		`query Product($productId: String!) {
			product(ProductId: $productId) {
				ProductId
				UserId
				ProductStatus
				ProductName
				ProductDescription
				ProductPrice
				ProductCategory
				ProductRegion
				ProductImage
				PreferedLocation
				Latitude
				Longitude
				ExactLocation
				AreaId
				AreaName
				ProductCreatedAt
				ProductUpdatedAt
			}
		}`,
		{ productId },
	);
});

const getUser = cache(async (userId: string) => {
	const { data } = await gql<{ user: User | null }>(
		`query User($userId: String!) {
			user(UserId: $userId) { UserId UserNickname ProfileImage PublishedQuantity }
		}`,
		{ userId },
	);
	return data?.user ?? null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { data } = await getProduct(params.id);
	const p = data?.product;
	const locale = (await getLocale()) as Locale;
	return p
		? { title: p.ProductName, description: `${formatPrice(p.ProductPrice, locale)} · ${p.PreferedLocation ?? ""}` }
		: { title: (await getTranslations("product"))("notFound") };
}

export default async function ProductDetailPage({ params }: Props) {
	const { data, error } = await getProduct(params.id);
	if (error) return <ErrorText role="alert">{error}</ErrorText>;
	const product = data?.product;
	if (!product) notFound();

	const seller = product.UserId ? await getUser(product.UserId) : null;
	const status = product.ProductStatus ?? STATUS_SELLING;
	const t = await getTranslations("product");
	const c = await getTranslations("common");
	const L = await getLabels();
	const locale = (await getLocale()) as Locale;

	return (
		<article>
			<Breadcrumb aria-label={c("breadcrumb")}>
				<Link href="/search">{(await getTranslations("market"))("title")}</Link>
				{product.ProductCategory && (
					<> › <Link href={`/search?category=${encodeURIComponent(product.ProductCategory)}`}>{L.enum("category", product.ProductCategory)}</Link></>
				)}
			</Breadcrumb>
			<DetailLayout>
				<ImageGallery images={product.ProductImage ?? []} name={product.ProductName} />
				<InfoPanel>
					<h1>{product.ProductName}</h1>
					<BigPrice>{formatPrice(product.ProductPrice, locale)}</BigPrice>
					<Facts>
						<dt>{t("category")}</dt><dd>{L.enum("category", product.ProductCategory) || "-"}</dd>
						<dt>{t("region")}</dt><dd>{L.enum("region", product.ProductRegion) || "-"}</dd>
						<dt>{t("place")}</dt><dd>{product.PreferedLocation ?? "-"}</dd>
						<dt>{t("status")}</dt><dd>{L.enum("status", status)}</dd>
						<dt>{t("posted")}</dt>
						<dd><TimeAgo ts={product.ProductCreatedAt} /></dd>
					</Facts>
					<ProductActions productId={product.ProductId} ownerId={product.UserId} status={status} price={product.ProductPrice} />
					{seller && <SellerCard user={seller} />}
				</InfoPanel>
			</DetailLayout>
			<Description>
				<h2>{t("description")}</h2>
				<p>{product.ProductDescription || t("noDescription")}</p>
			</Description>
			{product.Latitude != null && product.Longitude != null && (
				<LocationPreview
					label={product.PreferedLocation ?? ""}
					point={{ lat: product.Latitude, lng: product.Longitude }}
					exact={!!product.ExactLocation}
					areaId={product.AreaId ?? null}
					areaName={product.AreaName ?? null}
				/>
			)}
		</article>
	);
}
