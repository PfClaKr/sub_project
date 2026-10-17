'use client';

import { useEffect, useState } from "react";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { Avatar } from "@/components/ui/Avatar";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { CHAT_URL } from "@/libs/config";
import { EmptyState, ErrorText, GhostButton, Muted, Skeleton } from "@/styles/styledUi";
import { PostRows } from "@/styles/styledCommunity";
import type { BlockedUser } from "@/libs/types";

function List() {
	const [items, setItems] = useState<BlockedUser[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch(`${CHAT_URL}/blocks`, { credentials: "include" })
			.then(r => (r.ok ? r.json() : Promise.reject()))
			.then(setItems)
			.catch(() => setError("차단 목록을 불러오지 못했어요."));
	}, []);

	const unblock = async (id: string) => {
		const res = await fetch(`${CHAT_URL}/blocks/${id}`, { method: "DELETE", credentials: "include" }).catch(() => null);
		if (!res?.ok) {
			setError("해제하지 못했어요. 잠시 후 다시 시도해주세요.");
			return;
		}
		setItems(list => (list ?? []).filter(u => u.UserId !== id));
	};

	if (error) return <ErrorText role="alert">{error}</ErrorText>;
	if (!items) return <Skeleton $h="120px" />;
	if (items.length === 0) return <EmptyState><p>차단한 사용자가 없어요.</p></EmptyState>;
	return (
		<PostRows>
			{items.map(u => (
				<li key={u.UserId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px" }}>
					<Avatar name={u.UserNickname || "?"} size={36} />
					<div style={{ flex: 1, minWidth: 0 }}>
						<strong>{u.UserNickname || "탈퇴한 회원"}</strong>
						<Muted as="div" style={{ fontSize: 13 }}><TimeAgo ts={u.CreatedAt} /> 차단</Muted>
					</div>
					<GhostButton type="button" onClick={() => unblock(u.UserId)}>차단 해제</GhostButton>
				</li>
			))}
		</PostRows>
	);
}

export const BlockList = () => <RequireLogin>{() => <List />}</RequireLogin>;
