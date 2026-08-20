'use client';

import { useEffect, useState } from "react";
import { StyledLink } from "@/styles/styledLink";
import { CHAT_URL } from "@/libs/config";

type Room = {
	ChatId: string;
	ProductId: string;
	UserSeller: string;
	UserBuyer: string;
	CreatedAt: number;
};

export const ChatRoomList = () => {
	const [rooms, setRooms] = useState<Room[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch(`${CHAT_URL}/rooms`, { credentials: 'include' })
			.then(res => {
				if (res.status === 401) throw new Error("로그인이 필요해요.");
				if (!res.ok) throw new Error("채팅 목록을 불러오지 못했어요.");
				return res.json();
			})
			.then(setRooms)
			.catch(e => setError(e.message));
	}, []);

	if (error) return <p>{error}</p>;
	if (rooms === null) return <p>불러오는 중...</p>;
	if (rooms.length === 0) return <p>아직 채팅방이 없어요.</p>;

	return (
		<ul>
			{rooms.map(room => (
				<li key={room.ChatId}>
					<StyledLink href={`/chat/${room.ChatId}`}>
						상품 {room.ProductId} — 판매자 {room.UserSeller} / 구매자 {room.UserBuyer}
					</StyledLink>
				</li>
			))}
		</ul>
	);
};
