'use client';

import { useEffect, useState } from "react";
import { StyledLink } from "@/styles/styledLink";
import { RoomList } from "@/styles/styledChat";
import { EmptyState, ErrorText, LinkButton, Skeleton, StatusBadge } from "@/styles/styledUi";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { CHAT_URL } from "@/libs/config";
import { imageUrl } from "@/libs/format";
import { subjectOf, subjectTitle } from "@/libs/subjects";
import type { Room, Session } from "@/libs/types";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";

function Rooms({ session }: { session: Session }) {
	const t = useTranslations("chat");
	const L = useLabels();
	const [rooms, setRooms] = useState<Room[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch(`${CHAT_URL}/rooms`, { credentials: "include" })
			.then(res => {
				if (!res.ok) throw new Error(t("listError"));
				return res.json();
			})
			.then(setRooms)
			.catch(e => setError(e.message));
	}, [t]);

	if (error) return <ErrorText>{error}</ErrorText>;
	if (rooms === null) return <Skeleton $h="160px" />;
	if (rooms.length === 0) {
		return (
			<EmptyState>
				<p>{t("empty")}</p>
				<LinkButton href="/search">{t("browse")}</LinkButton>
			</EmptyState>
		);
	}

	return (
		<RoomList>
			{rooms.map(room => {
				const selling = room.UserSeller === session.UserId;
				const partner = selling ? room.BuyerNickname : room.SellerNickname;
				const thumb = imageUrl(room.SubjectImage || room.ProductImage);
				const kind = subjectOf(room).type;
				return (
					<li key={room.ChatId}>
						<StyledLink href={`/chat/${room.ChatId}`}>
							{thumb ? <img src={thumb} alt="" /> : <div className="thumb" />}
							<div style={{ minWidth: 0 }}>
								<strong>{partner || t("unknown")}</strong>
								<small>
									{selling ? `${t(`mine.${kind}`)} · ` : ""}{subjectTitle(room) || t(`missing.${kind}`)} · <TimeAgo ts={room.CreatedAt} />
								</small>
							</div>
							{kind === "product" && room.ProductStatus && room.ProductStatus !== "판매중" && (
								<StatusBadge $status={room.ProductStatus} style={{ marginLeft: "auto" }}>{L.enum("status", room.ProductStatus)}</StatusBadge>
							)}
						</StyledLink>
					</li>
				);
			})}
		</RoomList>
	);
}

export const ChatRoomList = () => <RequireLogin>{session => <Rooms session={session} />}</RequireLogin>;
