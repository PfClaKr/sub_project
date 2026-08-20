'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHAT_URL } from "@/libs/config";

export const ChatButton = ({ productId }: { productId: string }) => {
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleClick = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await fetch(`${CHAT_URL}/room/product/${productId}`, {
				credentials: 'include',
			});
			if (res.status === 401) {
				router.push('/login');
				return;
			}
			if (!res.ok) {
				const json = await res.json().catch(() => null);
				setError(json?.error === "cannot chat about your own product"
					? "내 상품에는 채팅할 수 없어요."
					: "채팅방을 열지 못했어요.");
				return;
			}
			const room = await res.json();
			router.push(`/chat/${room.ChatId}`);
		} catch {
			setError("채팅방을 열지 못했어요.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<>
			<button onClick={handleClick} disabled={loading}>
				{loading ? "여는 중..." : "채팅하기"}
			</button>
			{error && <p>{error}</p>}
		</>
	);
};
