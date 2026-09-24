'use client';

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CHAT_URL } from "@/libs/config";
import { ErrorText } from "@/styles/styledUi";

export const ChatButton = ({ productId, disabled }: { productId: string; disabled?: boolean }) => {
	const router = useRouter();
	const pathname = usePathname();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleClick = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await fetch(`${CHAT_URL}/room/product/${productId}`, { credentials: "include" });
			if (res.status === 401) {
				router.push(`/login?next=${encodeURIComponent(pathname)}`);
				return;
			}
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				setError(json?.error ?? "채팅방을 열지 못했어요.");
				return;
			}
			router.push(`/chat/${json.ChatId}`);
		} catch {
			setError("채팅방을 열지 못했어요.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<button onClick={handleClick} disabled={loading || disabled}>
				{disabled ? "판매완료" : loading ? "여는 중..." : "채팅하기"}
			</button>
			{error && <ErrorText role="alert">{error}</ErrorText>}
		</div>
	);
};
