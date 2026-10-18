'use client';

import { useEffect, useState } from "react";
import ProductGrid, { ProductGridSkeleton } from "@/components/product/ProductGrid";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { EmptyState, ErrorText, LinkButton } from "@/styles/styledUi";
import { API_URL } from "@/libs/config";
import type { Product } from "@/libs/types";
import { useLocale, useTranslations } from "next-intl";

function Favorites() {
	const t = useTranslations("product");
	const [products, setProducts] = useState<Product[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch(`${API_URL}/favorites`, { credentials: "include" })
			.then(res => {
				if (!res.ok) throw new Error(t("favError"));
				return res.json();
			})
			.then(setProducts)
			.catch(e => setError(e.message));
	}, [t]);

	if (error) return <ErrorText>{error}</ErrorText>;
	if (products === null) return <ProductGridSkeleton count={4} />;
	if (products.length === 0) {
		return (
			<EmptyState>
				<p>{t("noFavorites")}</p>
				<LinkButton href="/search">{t("browse")}</LinkButton>
			</EmptyState>
		);
	}
	return <ProductGrid products={products} />;
}

export const FavoriteList = () => <RequireLogin>{() => <Favorites />}</RequireLogin>;
