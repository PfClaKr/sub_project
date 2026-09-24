'use client';

import { useCallback, useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import {
	ChatHeader, ConnectionDot, MessageList, BubbleRow, Bubble, BubbleTime, ChatInputRow, DayDivider, EmptyHint,
} from "@/styles/styledChat";
import { ErrorText, Skeleton } from "@/styles/styledUi";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { CHAT_URL } from "@/libs/config";
import { formatDate, formatTime, imageUrl, toMs } from "@/libs/format";
import type { Message, Room, Session } from "@/libs/types";

const MAX_LENGTH = 1000;

function Conversation({ chatId, session }: { chatId: string; session: Session }) {
	const [room, setRoom] = useState<Room | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [error, setError] = useState("");
	const [connected, setConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const listRef = useRef<HTMLDivElement | null>(null);

	const loadHistory = useCallback(async () => {
		const res = await fetch(`${CHAT_URL}/history/${chatId}`, { credentials: "include" });
		if (!res.ok) throw new Error("채팅방을 불러오지 못했어요.");
		setMessages(await res.json());
	}, [chatId]);

	useEffect(() => {
		let closedByUs = false;
		let retry: ReturnType<typeof setTimeout> | undefined;
		let attempt = 0;

		// Reconnects with backoff and reloads history to fill any gap.
		const connect = () => {
			const ws = new WebSocket(`${CHAT_URL.replace(/^http/, "ws")}/ws/${chatId}`);
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
					const msg: Message = JSON.parse(event.data);
					setMessages(prev => (prev.some(m => m.MessageId === msg.MessageId) ? prev : [...prev, msg]));
				} catch {
					// Ignore non-JSON frames.
				}
			};
		};

		(async () => {
			try {
				const res = await fetch(`${CHAT_URL}/room/${chatId}`, { credentials: "include" });
				if (!res.ok) throw new Error("채팅방을 찾을 수 없어요.");
				setRoom(await res.json());
				await loadHistory();
				if (!closedByUs) connect();
			} catch (e) {
				if (!closedByUs) setError(e instanceof Error ? e.message : "오류가 발생했어요.");
			}
		})();

		return () => {
			closedByUs = true;
			clearTimeout(retry);
			wsRef.current?.close();
		};
	}, [chatId, loadHistory]);

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
	const partner = (selling ? room.BuyerNickname : room.SellerNickname) || "상대방";
	const thumb = imageUrl(room.ProductImage);

	let lastDay = "";
	return (
		<div>
			<ChatHeader>
				{thumb ? <img src={thumb} alt="" /> : <div />}
				<div style={{ minWidth: 0 }}>
					<strong>{partner}</strong>
					<small>
						<Link href={`/product/${room.ProductId}`}>{room.ProductName || "삭제된 상품"}</Link>
						{room.ProductStatus ? ` · ${room.ProductStatus}` : ""}
					</small>
				</div>
				<ConnectionDot $on={connected}>{connected ? "연결됨" : "연결 중..."}</ConnectionDot>
			</ChatHeader>
			<MessageList ref={listRef} aria-live="polite">
				{messages.length === 0 && (
					<EmptyHint>첫 메시지를 보내보세요.</EmptyHint>
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
			<ChatInputRow onSubmit={handleSend}>
				<input
					type="text"
					value={input}
					maxLength={MAX_LENGTH}
					onChange={e => setInput(e.target.value)}
					placeholder={connected ? "메시지를 입력하세요" : "연결 중..."}
					aria-label="메시지"
				/>
				<button type="submit" disabled={!connected || !input.trim()}>보내기</button>
			</ChatInputRow>
		</div>
	);
}

export const ChatRoom = ({ chatId }: { chatId: string }) => (
	<RequireLogin>{session => <Conversation chatId={chatId} session={session} />}</RequireLogin>
);
