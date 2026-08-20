'use client';

import { useEffect, useRef, useState, FormEvent } from "react";
import { CHAT_URL, LOGIN_URL } from "@/libs/config";

type Message = {
	MessageId: string;
	ChatId: string;
	UserId: string;
	Timestamp: number;
	Content: string;
};

export const ChatRoom = ({ chatId }: { chatId: string }) => {
	const [myUserId, setMyUserId] = useState<string | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [error, setError] = useState("");
	const [connected, setConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);
	const bottomRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		let ws: WebSocket | null = null;
		let cancelled = false;

		const start = async () => {
			try {
				const who = await fetch(`${LOGIN_URL}/whoami`, { credentials: 'include' });
				if (!who.ok) throw new Error("로그인이 필요해요.");
				const session = await who.json();

				const history = await fetch(`${CHAT_URL}/history/${chatId}`, { credentials: 'include' });
				if (!history.ok) throw new Error("채팅방을 불러오지 못했어요.");
				const past: Message[] = await history.json();
				if (cancelled) return;

				setMyUserId(session.UserId);
				setMessages(past);

				// Token cookie is sent along with the websocket handshake.
				ws = new WebSocket(`${CHAT_URL.replace(/^http/, 'ws')}/ws/${chatId}`);
				wsRef.current = ws;
				ws.onopen = () => setConnected(true);
				ws.onclose = () => setConnected(false);
				ws.onmessage = event => {
					try {
						const msg: Message = JSON.parse(event.data);
						setMessages(prev => [...prev, msg]);
					} catch {
						// Ignore non-JSON frames.
					}
				};
			} catch (e: any) {
				if (!cancelled) setError(e.message ?? "오류가 발생했어요.");
			}
		};
		start();

		return () => {
			cancelled = true;
			ws?.close();
		};
	}, [chatId]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages]);

	const handleSend = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const text = input.trim();
		if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
		wsRef.current.send(JSON.stringify({ Message: text }));
		setInput("");
	};

	if (error) return <p>{error}</p>;

	return (
		<div>
			<p>{connected ? "연결됨" : "연결 중..."}</p>
			<div>
				{messages.map(msg => (
					<div key={msg.MessageId}>
						<strong>{msg.UserId === myUserId ? "나" : msg.UserId}</strong>: {msg.Content}
					</div>
				))}
				<div ref={bottomRef} />
			</div>
			<form onSubmit={handleSend}>
				<input
					type="text"
					value={input}
					onChange={e => setInput(e.target.value)}
					placeholder="메시지를 입력하세요"
				/>
				<button type="submit" disabled={!connected}>보내기</button>
			</form>
		</div>
	);
};
