'use client';

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
	AlertTriangle, AtSign, Bell, CheckCircle2, Clock, Megaphone, MessageCircle, MessageSquare, RotateCcw, type LucideIcon,
} from "lucide-react";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { EmptyState, ErrorText, GhostButton, Skeleton } from "@/styles/styledUi";
import { ListActions, NoticeItem, NoticeList } from "@/styles/styledNotification";
import { gql } from "@/libs/graphql";
import { useNotifications } from "@/libs/notifications";
import { notificationHref, notificationTitle } from "@/libs/notificationText";
import type { AppNotification, NotificationType } from "@/libs/types";
import { TimeAgo } from "@/components/ui/TimeAgo";

const ICONS: Record<NotificationType, LucideIcon> = {
	comment: MessageSquare,
	reply: AtSign,
	accepted: CheckCircle2,
	expiring: Clock,
	hidden: AlertTriangle,
	restored: RotateCcw,
	chat: MessageCircle,
	notice: Megaphone,
};

type Page = { Items: AppNotification[]; Next: string };

const QUERY = `query($before: String) {
	notifications(Before: $before) { Items { SortKey Type Preview Link Read CreatedAt } Next }
}`;

function List() {
	const { refresh } = useNotifications();
	const [items, setItems] = useState<AppNotification[] | null>(null);
	const [next, setNext] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const load = useCallback(async (before = "") => {
		setBusy(true);
		const { data, error } = await gql<{ notifications: Page }>(QUERY, { before: before || null });
		setBusy(false);
		if (error || !data) {
			setError(error ?? "알림을 불러오지 못했어요.");
			return;
		}
		setItems(prev => (before && prev ? [...prev, ...data.notifications.Items] : data.notifications.Items));
		setNext(data.notifications.Next);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const markRead = async (keys?: string[]) => {
		const { error } = await gql(`mutation($keys: [String!]) { markNotificationsRead(SortKeys: $keys) }`, { keys: keys ?? null });
		if (error) return;
		setItems(prev => prev?.map(n => (!keys || keys.includes(n.SortKey) ? { ...n, Read: true } : n)) ?? prev);
		refresh();
	};

	if (error) return <ErrorText>{error}</ErrorText>;
	if (items === null) return <Skeleton $h="240px" />;
	if (items.length === 0) {
		return (
			<EmptyState>
				<Bell size={28} aria-hidden />
				<p>아직 알림이 없어요. 내 글에 댓글이 달리거나 답변이 채택되면 여기에 알려드릴게요.</p>
			</EmptyState>
		);
	}

	const unread = items.filter(n => !n.Read).length;
	return (
		<>
			{unread > 0 && (
				<ListActions>
					<span>읽지 않은 알림 <strong>{unread}</strong>개</span>
					<GhostButton onClick={() => markRead()}>모두 읽음</GhostButton>
				</ListActions>
			)}
			<NoticeList>
				{items.map(n => {
					const Icon = ICONS[n.Type] ?? Bell;
					return (
						<li key={n.SortKey}>
							<NoticeItem
								as={Link}
								href={notificationHref(n)}
								$unread={!n.Read}
								onClick={() => !n.Read && markRead([n.SortKey])}
							>
								<Icon size={20} aria-hidden />
								<div>
									<strong>{notificationTitle(n)}</strong>
									{n.Preview && <p>{n.Preview}</p>}
									<small><TimeAgo ts={n.CreatedAt} />{n.Read ? "" : " · 읽지 않음"}</small>
								</div>
							</NoticeItem>
						</li>
					);
				})}
			</NoticeList>
			{next && (
				<ListActions style={{ justifyContent: "center", marginTop: 12 }}>
					<GhostButton disabled={busy} onClick={() => load(next)}>{busy ? "불러오는 중..." : "더 보기"}</GhostButton>
				</ListActions>
			)}
		</>
	);
}

export function NotificationList() {
	return <RequireLogin>{() => <List />}</RequireLogin>;
}
