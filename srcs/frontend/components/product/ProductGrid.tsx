'use client';

import ProductCard from "@/components/product/ProductCard";
import { StyledLink } from "@/styles/styledLink";
import { Grid } from "@/styles/styledProductCard";
import { Skeleton } from "@/styles/styledUi";
import type { Product } from "@/libs/types";

export default function ProductGrid({ products }: { products: Product[] }) {
	return (
		<Grid>
			{products.map(product => (
				<li key={product.ProductId}>
					<StyledLink href={`/product/${product.ProductId}`}>
						<ProductCard product={product} />
					</StyledLink>
				</li>
			))}
		</Grid>
	);
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
	return (
		<Grid aria-busy="true" aria-label="불러오는 중">
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
