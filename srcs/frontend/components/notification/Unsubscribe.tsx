'use client';

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { API_URL } from "@/libs/config";
import { EmptyState, LinkButton, Skeleton } from "@/styles/styledUi";

// Unsubscribe is the page behind the link at the bottom of notification
// mails: the signed link itself proves the request, no login needed.
export function Unsubscribe() {
	const sp = useSearchParams();
	const [state, setState] = useState<"busy" | "done" | "error">("busy");
	const sent = useRef(false);

	useEffect(() => {
		if (sent.current) return;
		sent.current = true;
		fetch(`${API_URL}/notifications/unsubscribe`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ U: sp.get("u") ?? "", T: sp.get("t") ?? "" }),
		})
			.then(res => setState(res.ok ? "done" : "error"))
			.catch(() => setState("error"));
	}, [sp]);

	if (state === "busy") return <Skeleton $h="160px" />;
	return (
		<EmptyState>
			<p>{state === "done" ? "이메일 알림을 껐어요. 사이트 안의 알림은 계속 받을 수 있어요." : "링크가 올바르지 않거나 만료됐어요."}</p>
			<LinkButton href="/myaccount/notifications">알림 설정 열기</LinkButton>
		</EmptyState>
	);
}
