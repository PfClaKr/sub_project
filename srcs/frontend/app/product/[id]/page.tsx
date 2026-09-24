import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageGallery } from "@/components/product/detail/ImageGallery";
import { ProductActions } from "@/components/product/detail/ProductActions";
import { SellerCard } from "@/components/product/detail/SellerCard";
import { LocationPreview } from "@/components/product/detail/LocationPreview";
import { Breadcrumb, DetailLayout, InfoPanel, BigPrice, Facts, Description } from "@/styles/styledDetail";
import { ErrorText } from "@/styles/styledUi";
import { gql } from "@/libs/graphql";
import { formatDate, formatPrice, formatRelative } from "@/libs/format";
import { STATUS_SELLING } from "@/libs/constants";
import type { Product, User } from "@/libs/types";

type Props = { params: { id: string } };

async function getProduct(productId: string) {
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
}

async function getUser(userId: string) {
	const { data } = await gql<{ user: User | null }>(
		`query User($userId: String!) {
			user(UserId: $userId) { UserId UserNickname ProfileImage PublishedQuantity }
		}`,
		{ userId },
	);
	return data?.user ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { data } = await getProduct(params.id);
	const p = data?.product;
	return p
		? { title: p.ProductName, description: `${formatPrice(p.ProductPrice)} · ${p.PreferedLocation ?? ""}` }
		: { title: "상품을 찾을 수 없어요" };
}

export default async function ProductDetailPage({ params }: Props) {
	const { data, error } = await getProduct(params.id);
	if (error) return <ErrorText role="alert">{error}</ErrorText>;
	const product = data?.product;
	if (!product) notFound();

	const seller = product.UserId ? await getUser(product.UserId) : null;
	const status = product.ProductStatus ?? STATUS_SELLING;

	return (
		<article>
			<Breadcrumb aria-label="위치">
				<Link href="/">홈</Link>
				{product.ProductCategory && (
					<> › <Link href={`/?category=${encodeURIComponent(product.ProductCategory)}`}>{product.ProductCategory}</Link></>
				)}
			</Breadcrumb>
			<DetailLayout>
				<ImageGallery images={product.ProductImage ?? []} name={product.ProductName} />
				<InfoPanel>
					<h1>{product.ProductName}</h1>
					<BigPrice>{formatPrice(product.ProductPrice)}</BigPrice>
					<Facts>
						<dt>카테고리</dt><dd>{product.ProductCategory ?? "-"}</dd>
						<dt>지역</dt><dd>{product.ProductRegion ?? "-"}</dd>
						<dt>거래 장소</dt><dd>{product.PreferedLocation ?? "-"}</dd>
						<dt>판매 상태</dt><dd>{status}</dd>
						<dt>게시일</dt>
						<dd title={formatDate(product.ProductCreatedAt)}>{formatRelative(product.ProductCreatedAt)}</dd>
					</Facts>
					<ProductActions productId={product.ProductId} ownerId={product.UserId} status={status} />
					{seller && <SellerCard user={seller} />}
				</InfoPanel>
			</DetailLayout>
			<Description>
				<h2>상품 설명</h2>
				<p>{product.ProductDescription || "설명이 없어요."}</p>
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
