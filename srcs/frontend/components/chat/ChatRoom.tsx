'use client';

import { useCallback, useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import {
	BlockedBar, ChatHeader, ConnectionDot, MessageList, BubbleRow, Bubble, BubbleTime, ChatInputRow, DayDivider, EmptyHint,
} from "@/styles/styledChat";
import { ErrorText, GhostButton, Skeleton } from "@/styles/styledUi";
import { ChatMenu } from "./ChatMenu";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { CHAT_URL, chatSocketUrl } from "@/libs/config";
import { formatDate, formatTime, imageUrl, toMs } from "@/libs/format";
import { subjectHref, subjectOf, subjectTitle } from "@/libs/subjects";
import type { Message, Room, Session } from "@/libs/types";
import { useTranslations } from "next-intl";

const MAX_LENGTH = 1000;

function Conversation({ chatId, session }: { chatId: string; session: Session }) {
	const t = useTranslations("chat");
	const [room, setRoom] = useState<Room | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [error, setError] = useState("");
	const [connected, setConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const listRef = useRef<HTMLDivElement | null>(null);

	const loadHistory = useCallback(async () => {
		const res = await fetch(`${CHAT_URL}/history/${chatId}`, { credentials: "include" });
		if (!res.ok) throw new Error(t("loadError"));
		setMessages(await res.json());
	}, [chatId, t]);

	useEffect(() => {
		let closedByUs = false;
		let retry: ReturnType<typeof setTimeout> | undefined;
		let attempt = 0;

		// Reconnects with backoff and reloads history to fill any gap.
		const connect = () => {
			const ws = new WebSocket(chatSocketUrl(`/ws/${chatId}`));
			wsRef.current = ws;
			ws.onopen = () => {
				if (attempt > 0) loadHistory().catch(() => {});
				attempt = 0;
				setConnected(true);
			};
			ws.onclose = () => {
				setConnected(false);
				if (closedByUs) return;
				attempt++;
				retry = setTimeout(connect, Math.min(1000 * 2 ** attempt, 15000));
			};
			ws.onmessage = event => {
				try {
					const msg = JSON.parse(event.data);
					// The server refuses messages once either side blocked.
					if (msg.Error === "blocked") {
						setRoom(r => (r ? { ...r, Blocked: true } : r));
						return;
					}
					setMessages(prev => (prev.some(m => m.MessageId === msg.MessageId) ? prev : [...prev, msg]));
				} catch {
					// Ignore non-JSON frames.
				}
			};
		};

		(async () => {
			try {
				const res = await fetch(`${CHAT_URL}/room/${chatId}`, { credentials: "include" });
				if (!res.ok) throw new Error(t("notFound"));
				setRoom(await res.json());
				await loadHistory();
				if (!closedByUs) connect();
			} catch (e) {
				if (!closedByUs) setError(e instanceof Error ? e.message : t("error"));
			}
		})();

		return () => {
			closedByUs = true;
			clearTimeout(retry);
			wsRef.current?.close();
		};
	}, [chatId, loadHistory, t]);

	useEffect(() => {
		const el = listRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [messages]);

	const handleSend = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const text = input.trim();
		if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
		wsRef.current.send(JSON.stringify({ Message: text }));
		setInput("");
	};

	if (error) return <ErrorText>{error}</ErrorText>;
	if (!room) return <Skeleton $h="400px" />;

	const selling = room.UserSeller === session.UserId;
	const partnerId = selling ? room.UserBuyer : room.UserSeller;
	const setBlock = async (block: boolean) => {
		const res = await fetch(`${CHAT_URL}/blocks/${partnerId}`, { method: block ? "PUT" : "DELETE", credentials: "include" }).catch(() => null);
		if (!res?.ok) {
			setError(t("actionError"));
			return;
		}
		// Unblocking only clears our side; the other may still block us.
		const fresh = await fetch(`${CHAT_URL}/room/${chatId}`, { credentials: "include" }).then(r => (r.ok ? r.json() : null)).catch(() => null);
		setRoom(fresh ?? { ...room, BlockedByMe: block, Blocked: block });
	};
	const partner = (selling ? room.BuyerNickname : room.SellerNickname) || t("partner");
	const thumb = imageUrl(room.SubjectImage || room.ProductImage);
	const status = room.SubjectType === "product" || !room.SubjectType ? room.ProductStatus : undefined;

	let lastDay = "";
	return (
		<div>
			<ChatHeader>
				{thumb ? <img src={thumb} alt="" /> : <div />}
				<div style={{ minWidth: 0 }}>
					<strong>{partner}</strong>
					<small>
						<Link href={subjectHref(room)}>{subjectTitle(room) || t(`missing.${subjectOf(room).type}`)}</Link>
						{status ? ` · ${status}` : ""}
					</small>
				</div>
				<ConnectionDot $on={connected}>{connected ? t("connected") : t("connecting")}</ConnectionDot>
				<ChatMenu chatId={chatId} partner={partner} blockedByMe={!!room.BlockedByMe} onBlock={setBlock} />
			</ChatHeader>
			<MessageList ref={listRef} aria-live="polite">
				{messages.length === 0 && (
					<EmptyHint>{t("first")}</EmptyHint>
				)}
				{messages.map(msg => {
					const mine = msg.UserId === session.UserId;
					const day = formatDate(msg.Timestamp);
					const showDay = day !== lastDay;
					lastDay = day;
					return (
						<div key={msg.MessageId}>
							{showDay && <DayDivider>{day}</DayDivider>}
							<BubbleRow $mine={mine}>
								<Bubble $mine={mine}>{msg.Content}</Bubble>
								<BubbleTime dateTime={new Date(toMs(msg.Timestamp)).toISOString()}>
									{formatTime(msg.Timestamp)}
								</BubbleTime>
							</BubbleRow>
						</div>
					);
				})}
			</MessageList>
			{room.Blocked ? (
				<BlockedBar role="status">
					{room.BlockedByMe ? t("youBlocked") : t("cannotTalk")}
					{room.BlockedByMe && <GhostButton type="button" onClick={() => setBlock(false)}>{t("unblock")}</GhostButton>}
				</BlockedBar>
			) : (
			<ChatInputRow onSubmit={handleSend}>
				<input
					type="text"
					value={input}
					maxLength={MAX_LENGTH}
					onChange={e => setInput(e.target.value)}
					placeholder={connected ? t("placeholder") : t("connecting")}
					aria-label={t("message")}
				/>
				<button type="submit" disabled={!connected || !input.trim()}>{t("send")}</button>
			</ChatInputRow>
			)}
		</div>
	);
}

export const ChatRoom = ({ chatId }: { chatId: string }) => (
	<RequireLogin>{session => <Conversation chatId={chatId} session={session} />}</RequireLogin>
);
