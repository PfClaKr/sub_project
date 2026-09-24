'use client';

import { useEffect, useState } from "react";
import { ProductForm } from "@/components/form/ProductForm";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { PageHeader } from "@/styles/styledLayout";
import { EmptyState, ErrorText, LinkButton, Skeleton } from "@/styles/styledUi";
import { gql } from "@/libs/graphql";
import type { Product, Session } from "@/libs/types";

function EditProduct({ productId, session }: { productId: string; session: Session }) {
	const [product, setProduct] = useState<Product | null | undefined>(undefined);
	const [error, setError] = useState("");

	useEffect(() => {
		gql<{ product: Product | null }>(
			`query P($productId: String!) {
				product(ProductId: $productId) {
					ProductId UserId ProductName ProductDescription ProductPrice ProductCategory ProductImage PreferedLocation ProductRegion Latitude Longitude ExactLocation AreaId
				}
			}`,
			{ productId },
		).then(({ data, error }) => {
			if (error) setError(error);
			setProduct(data?.product ?? null);
		});
	}, [productId]);

	if (error) return <ErrorText role="alert">{error}</ErrorText>;
	if (product === undefined) return <Skeleton $h="400px" />;
	if (!product || product.UserId !== session.UserId) {
		return (
			<EmptyState>
				<p>수정할 수 없는 상품이에요.</p>
				<LinkButton href={`/product/${productId}`} $ghost>상품으로 돌아가기</LinkButton>
			</EmptyState>
		);
	}
	return <ProductForm product={product} />;
}

export default function EditProductPage({ params }: { params: { id: string } }) {
	return (
		<div>
			<PageHeader>
				<h1>상품 수정</h1>
			</PageHeader>
			<RequireLogin>{session => <EditProduct productId={params.id} session={session} />}</RequireLogin>
		</div>
	);
}
