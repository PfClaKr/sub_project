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
import { formatPrice, imageUrl } from "@/libs/format";
import type { Product } from "@/libs/types";
import { TimeAgo } from "@/components/ui/TimeAgo";

export default function ProductCard({ product, showSeller = true }: { product: Product; showSeller?: boolean }) {
	const thumb = imageUrl(product.ProductImage?.[0]);
	const status = product.ProductStatus ?? STATUS_SELLING;

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
				<Subtitle>
					{product.PreferedLocation}{product.PreferedLocation && product.ProductCreatedAt ? " · " : ""}
					<TimeAgo ts={product.ProductCreatedAt} />
				</Subtitle>
				{showSeller && product.SellerNickname && <Subtitle>{product.SellerNickname}</Subtitle>}
			</InfoContainer>
		</Card>
	);
}
