'use client';

import { useEffect, useState } from "react";
import { StyledLink } from "@/styles/styledLink";
import { RoomList, RoomCard, RoomTitle, RoomMeta } from "@/styles/styledChat";
import { EmptyState } from "@/styles/styledCommon";
import { CHAT_URL, GRAPHQL_URL } from "@/libs/config";

type Room = {
	ChatId: string;
	ProductId: string;
	UserSeller: string;
	UserBuyer: string;
	CreatedAt: number;
};

type ProductInfo = {
	ProductName?: string;
	ProductImage?: string[];
};

async function getProductInfo(productId: string): Promise<ProductInfo> {
	try {
		const res = await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				query: `query P($id: String!) { product(ProductId: $id) { ProductName ProductImage } }`,
				variables: { id: productId },
			}),
		});
		const json = res.ok ? await res.json() : null;
		return json?.data?.product ?? {};
	} catch {
		return {};
	}
}

export const ChatRoomList = () => {
	const [rooms, setRooms] = useState<(Room & { product: ProductInfo })[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch(`${CHAT_URL}/rooms`, { credentials: 'include' })
			.then(res => {
				if (res.status === 401) throw new Error("로그인이 필요해요.");
				if (!res.ok) throw new Error("채팅 목록을 불러오지 못했어요.");
				return res.json();
			})
			.then(async (list: Room[]) => {
				const withProducts = await Promise.all(
					list.map(async room => ({ ...room, product: await getProductInfo(room.ProductId) }))
				);
				setRooms(withProducts);
			})
			.catch(e => setError(e.message));
	}, []);

	if (error) return <EmptyState>{error}</EmptyState>;
	if (rooms === null) return <p>불러오는 중...</p>;
	if (rooms.length === 0) return <EmptyState>아직 채팅방이 없어요.<br />상품 페이지에서 채팅을 시작해보세요.</EmptyState>;

	return (
		<RoomList>
			{rooms.map(room => (
				<RoomCard key={room.ChatId}>
					<StyledLink href={`/chat/${room.ChatId}`}>
						{room.product.ProductImage?.[0] && <img src={room.product.ProductImage[0]} alt="" />}
						<div>
							<RoomTitle>{room.product.ProductName ?? "삭제된 상품"}</RoomTitle>
							<RoomMeta>판매자 {room.UserSeller.slice(0, 8)} · 구매자 {room.UserBuyer.slice(0, 8)}</RoomMeta>
						</div>
					</StyledLink>
				</RoomCard>
			))}
		</RoomList>
	);
};
