'use client';

import { useState } from "react";
import { LOGIN_URL } from "@/libs/config";
import { GhostButton, Muted } from "@/styles/styledUi";

// Asks the loginserver to mail a fresh activation link.
export function ResendVerification({ email }: { email: string }) {
	const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

	const resend = async () => {
		setState("sending");
		try {
			const res = await fetch(`${LOGIN_URL}/verify/resend?email=${encodeURIComponent(email)}`, { method: "POST" });
			setState(res.ok ? "sent" : "error");
		} catch {
			setState("error");
		}
	};

	if (state === "sent") return <Muted role="status">인증 메일을 다시 보냈어요. 메일함을 확인해주세요.</Muted>;
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<GhostButton type="button" onClick={resend} disabled={state === "sending" || !email}>
				{state === "sending" ? "보내는 중..." : "인증 메일 다시 보내기"}
			</GhostButton>
			{state === "error" && <Muted role="alert">메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.</Muted>}
		</div>
	);
}
