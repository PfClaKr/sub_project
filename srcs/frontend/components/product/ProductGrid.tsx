'use client';

import ProductCard from "@/components/product/ProductCard";
import { StyledLink } from "@/styles/styledLink";
import { Grid } from "@/styles/styledProductCard";
import { Skeleton } from "@/styles/styledUi";
import type { Product } from "@/libs/types";
import { useLocale, useTranslations } from "next-intl";

// showSeller: false on a member's own list, where every card has the same name.
// preview: show only as many as fill whole rows (the home's 12).
export default function ProductGrid({ products, showSeller = true, preview }: { products: Product[]; showSeller?: boolean; preview?: boolean }) {
	return (
		<Grid $preview={preview}>
			{products.map(product => (
				<li key={product.ProductId}>
					<StyledLink href={`/product/${product.ProductId}`}>
						<ProductCard product={product} showSeller={showSeller} />
					</StyledLink>
				</li>
			))}
		</Grid>
	);
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
	const t = useTranslations("product");
	return (
		<Grid aria-busy="true" aria-label={t("loading")}>
			{Array.from({ length: count }, (_, i) => (
				<li key={i}>
					<Skeleton $h="auto" style={{ aspectRatio: "1 / 1" }} />
					<Skeleton $h="14px" $w="80%" style={{ marginTop: 10 }} />
					<Skeleton $h="18px" $w="40%" style={{ marginTop: 6 }} />
				</li>
			))}
		</Grid>
	);
}
