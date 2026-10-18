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
import { useLocale, useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
import type { Locale } from "@/i18n/config";

export default function ProductCard({ product, showSeller = true }: { product: Product; showSeller?: boolean }) {
	const t = useTranslations("product");
	const L = useLabels();
	const locale = useLocale() as Locale;
	const thumb = imageUrl(product.ProductImage?.[0]);
	const status = product.ProductStatus ?? STATUS_SELLING;

	return (
		<Card $dimmed={status === "판매완료"}>
			<ThumbContainer>
				{thumb
					? <img src={thumb} alt={product.ProductName} loading="lazy" />
					: <NoImage>{t("noPhoto")}</NoImage>}
				{status !== STATUS_SELLING && (
					<BadgeSlot><StatusBadge $status={status}>{L.enum("status", status)}</StatusBadge></BadgeSlot>
				)}
			</ThumbContainer>
			<InfoContainer>
				<Title title={product.ProductName}>{product.ProductName}</Title>
				<Price>{formatPrice(product.ProductPrice, locale)}</Price>
				<Subtitle>
					{product.PreferedLocation}{product.PreferedLocation && product.ProductCreatedAt ? " · " : ""}
					<TimeAgo ts={product.ProductCreatedAt} />
				</Subtitle>
				{showSeller && product.SellerNickname && <Subtitle>{product.SellerNickname}</Subtitle>}
			</InfoContainer>
		</Card>
	);
}
