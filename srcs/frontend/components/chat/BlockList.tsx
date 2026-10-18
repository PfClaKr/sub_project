'use client';

import { useEffect, useState } from "react";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { Avatar } from "@/components/ui/Avatar";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { CHAT_URL } from "@/libs/config";
import { EmptyState, ErrorText, GhostButton, Muted, Skeleton } from "@/styles/styledUi";
import { PostRows } from "@/styles/styledCommunity";
import type { BlockedUser } from "@/libs/types";
import { useTranslations } from "next-intl";

function List() {
	const t = useTranslations("chat");
	const [items, setItems] = useState<BlockedUser[] | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		fetch(`${CHAT_URL}/blocks`, { credentials: "include" })
			.then(r => (r.ok ? r.json() : Promise.reject()))
			.then(setItems)
			.catch(() => setError(t("blockListError")));
	}, [t]);

	const unblock = async (id: string) => {
		const res = await fetch(`${CHAT_URL}/blocks/${id}`, { method: "DELETE", credentials: "include" }).catch(() => null);
		if (!res?.ok) {
			setError(t("actionError"));
			return;
		}
		setItems(list => (list ?? []).filter(u => u.UserId !== id));
	};

	if (error) return <ErrorText role="alert">{error}</ErrorText>;
	if (!items) return <Skeleton $h="120px" />;
	if (items.length === 0) return <EmptyState><p>{t("noBlocked")}</p></EmptyState>;
	return (
		<PostRows>
			{items.map(u => (
				<li key={u.UserId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 4px" }}>
					<Avatar name={u.UserNickname || "?"} size={36} />
					<div style={{ flex: 1, minWidth: 0 }}>
						<strong>{u.UserNickname || t("leftMember")}</strong>
						<Muted as="div" style={{ fontSize: 13 }}>{t.rich("blockedAgo", { ago: () => <TimeAgo ts={u.CreatedAt} /> })}</Muted>
					</div>
					<GhostButton type="button" onClick={() => unblock(u.UserId)}>{t("unblock")}</GhostButton>
				</li>
			))}
		</PostRows>
	);
}

export const BlockList = () => <RequireLogin>{() => <List />}</RequireLogin>;
