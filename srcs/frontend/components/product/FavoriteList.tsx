'use client';

import { useEffect, useState } from "react";
import ProductGrid, { ProductGridSkeleton } from "@/components/product/ProductGrid";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { EmptyState, ErrorText, LinkButton } from "@/styles/styledUi";
import { API_URL } from "@/libs/config";
import type { Product } from "@/libs/types";

function Favorites() {
	const [products, setProducts] = useState<Product[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch(`${API_URL}/favorites`, { credentials: "include" })
			.then(res => {
				if (!res.ok) throw new Error("찜 목록을 불러오지 못했어요.");
				return res.json();
			})
			.then(setProducts)
			.catch(e => setError(e.message));
	}, []);

	if (error) return <ErrorText>{error}</ErrorText>;
	if (products === null) return <ProductGridSkeleton count={4} />;
	if (products.length === 0) {
		return (
			<EmptyState>
				<p>아직 찜한 상품이 없어요.</p>
				<LinkButton href="/">상품 둘러보기</LinkButton>
			</EmptyState>
		);
	}
	return <ProductGrid products={products} />;
}

export const FavoriteList = () => <RequireLogin>{() => <Favorites />}</RequireLogin>;
