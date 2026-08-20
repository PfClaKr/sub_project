'use client';

import { useCallback, useEffect, useState } from "react";
import { StyledLink } from "@/styles/styledLink";
import { GRAPHQL_URL, LOGIN_URL } from "@/libs/config";

type Session = {
	UserId: string;
	UserNickname?: string;
	ProfileImage?: string;
};

type Product = {
	ProductId: string;
	ProductName: string;
	ProductPrice: number;
	ProductStatus?: string;
};

export const MyAccount = () => {
	const [session, setSession] = useState<Session | null>(null);
	const [products, setProducts] = useState<Product[] | null>(null);
	const [error, setError] = useState("");

	const loadProducts = useCallback(async (userId: string) => {
		const res = await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `query MyProducts($userId: String!) {
					userProducts(UserId: $userId) {
						ProductId
						ProductName
						ProductPrice
						ProductStatus
					}
				}`,
				variables: { userId },
			}),
		});
		const json = res.ok ? await res.json() : null;
		setProducts(json?.data?.userProducts ?? []);
	}, []);

	useEffect(() => {
		fetch(`${LOGIN_URL}/whoami`, { credentials: 'include' })
			.then(res => {
				if (!res.ok) throw new Error("로그인이 필요해요.");
				return res.json();
			})
			.then((s: Session) => {
				setSession(s);
				return loadProducts(s.UserId);
			})
			.catch(e => setError(e.message));
	}, [loadProducts]);

	const handleDelete = async (productId: string) => {
		if (!session) return;
		if (!window.confirm("이 상품을 삭제할까요?")) return;
		const res = await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `mutation D($productId: String!) {
					deleteProduct(ProductId: $productId)
				}`,
				variables: { productId },
			}),
		});
		if (res.ok) await loadProducts(session.UserId);
	};

	if (error) return <p>{error}</p>;
	if (!session) return <p>불러오는 중...</p>;

	return (
		<div>
			<div>
				<p><strong>{session.UserNickname ?? session.UserId}</strong>님의 마이페이지</p>
			</div>
			<div>
				<p>내가 올린 상품</p>
				{products === null && <p>불러오는 중...</p>}
				{products?.length === 0 && <p>아직 올린 상품이 없어요.</p>}
				<ul>
					{products?.map(product => (
						<li key={product.ProductId}>
							<StyledLink href={`/product/${product.ProductId}`}>
								{product.ProductName} — €{product.ProductPrice} [{product.ProductStatus ?? "판매중"}]
							</StyledLink>
							<button onClick={() => handleDelete(product.ProductId)}>삭제</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
};
