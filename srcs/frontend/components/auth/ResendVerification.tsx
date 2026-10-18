'use client';

import { useState } from "react";
import { LOGIN_URL } from "@/libs/config";
import { GhostButton, Muted } from "@/styles/styledUi";
import { useTranslations } from "next-intl";

// Asks the loginserver to mail a fresh activation link.
export function ResendVerification({ email }: { email: string }) {
	const t = useTranslations("auth");
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

	if (state === "sent") return <Muted role="status">{t("resent")}</Muted>;
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<GhostButton type="button" onClick={resend} disabled={state === "sending" || !email}>
				{state === "sending" ? t("sending") : t("resend")}
			</GhostButton>
			{state === "error" && <Muted role="alert">{t("resendError")}</Muted>}
		</div>
	);
}
