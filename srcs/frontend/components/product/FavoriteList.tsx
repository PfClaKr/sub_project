'use client';

import { useEffect, useState } from "react";
import DisplayTray from "@/components/product/DisplayTray";
import { API_URL } from "@/libs/config";

export const FavoriteList = () => {
	const [products, setProducts] = useState<any[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch(`${API_URL}/favorites`, { credentials: 'include' })
			.then(res => {
				if (res.status === 401) throw new Error("로그인이 필요해요.");
				if (!res.ok) throw new Error("찜 목록을 불러오지 못했어요.");
				return res.json();
			})
			.then(setProducts)
			.catch(e => setError(e.message));
	}, []);

	if (error) return <p>{error}</p>;
	if (products === null) return <p>불러오는 중...</p>;
	if (products.length === 0) return <p>아직 찜한 상품이 없어요.</p>;

	return <DisplayTray products={products} />;
};
