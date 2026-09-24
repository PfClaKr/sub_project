'use client';

import {
	Card,
	ThumbContainer,
	NoImage,
	BadgeSlot,
	InfoContainer,
	Title,
	Price,
	Subtitle,
} from "@/styles/styledProductCard";
import { StatusBadge } from "@/styles/styledUi";
import { STATUS_SELLING } from "@/libs/constants";
import { formatPrice, formatRelative, imageUrl } from "@/libs/format";
import type { Product } from "@/libs/types";

export default function ProductCard({ product }: { product: Product }) {
	const thumb = imageUrl(product.ProductImage?.[0]);
	const status = product.ProductStatus ?? STATUS_SELLING;
	const meta = [product.PreferedLocation, formatRelative(product.ProductCreatedAt)].filter(Boolean).join(" · ");

	return (
		<Card $dimmed={status === "판매완료"}>
			<ThumbContainer>
				{thumb
					? <img src={thumb} alt={product.ProductName} loading="lazy" />
					: <NoImage>사진 없음</NoImage>}
				{status !== STATUS_SELLING && (
					<BadgeSlot><StatusBadge $status={status}>{status}</StatusBadge></BadgeSlot>
				)}
			</ThumbContainer>
			<InfoContainer>
				<Title title={product.ProductName}>{product.ProductName}</Title>
				<Price>{formatPrice(product.ProductPrice)}</Price>
				{meta && <Subtitle>{meta}</Subtitle>}
				{product.SellerNickname && <Subtitle>{product.SellerNickname}</Subtitle>}
			</InfoContainer>
		</Card>
	);
}
