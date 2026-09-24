'use client';

import { useEffect, useState } from "react";
import { StyledLink } from "@/styles/styledLink";
import { RoomList } from "@/styles/styledChat";
import { EmptyState, ErrorText, LinkButton, Skeleton, StatusBadge } from "@/styles/styledUi";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { CHAT_URL } from "@/libs/config";
import { formatRelative, imageUrl } from "@/libs/format";
import type { Room, Session } from "@/libs/types";

function Rooms({ session }: { session: Session }) {
	const [rooms, setRooms] = useState<Room[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch(`${CHAT_URL}/rooms`, { credentials: "include" })
			.then(res => {
				if (!res.ok) throw new Error("채팅 목록을 불러오지 못했어요.");
				return res.json();
			})
			.then(setRooms)
			.catch(e => setError(e.message));
	}, []);

	if (error) return <ErrorText>{error}</ErrorText>;
	if (rooms === null) return <Skeleton $h="160px" />;
	if (rooms.length === 0) {
		return (
			<EmptyState>
				<p>아직 채팅방이 없어요. 마음에 드는 상품에서 &lsquo;채팅하기&rsquo;를 눌러보세요.</p>
				<LinkButton href="/">상품 둘러보기</LinkButton>
			</EmptyState>
		);
	}

	return (
		<RoomList>
			{rooms.map(room => {
				const selling = room.UserSeller === session.UserId;
				const partner = selling ? room.BuyerNickname : room.SellerNickname;
				const thumb = imageUrl(room.ProductImage);
				return (
					<li key={room.ChatId}>
						<StyledLink href={`/chat/${room.ChatId}`}>
							{thumb ? <img src={thumb} alt="" /> : <div className="thumb" />}
							<div style={{ minWidth: 0 }}>
								<strong>{partner || "알 수 없는 사용자"}</strong>
								<small>
									{selling ? "내 상품 · " : ""}{room.ProductName || "삭제된 상품"} · {formatRelative(room.CreatedAt)}
								</small>
							</div>
							{room.ProductStatus && room.ProductStatus !== "판매중" && (
								<StatusBadge $status={room.ProductStatus} style={{ marginLeft: "auto" }}>{room.ProductStatus}</StatusBadge>
							)}
						</StyledLink>
					</li>
				);
			})}
		</RoomList>
	);
}

export const ChatRoomList = () => <RequireLogin>{session => <Rooms session={session} />}</RequireLogin>;
