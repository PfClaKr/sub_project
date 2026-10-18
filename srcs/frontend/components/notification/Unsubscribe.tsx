'use client';

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { API_URL } from "@/libs/config";
import { EmptyState, LinkButton, Skeleton } from "@/styles/styledUi";
import { useTranslations } from "next-intl";

// Unsubscribe is the page behind the link at the bottom of notification
// mails: the signed link itself proves the request, no login needed.
export function Unsubscribe() {
	const t = useTranslations("notifications");
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
			<p>{state === "done" ? t("unsubscribed") : t("badLink")}</p>
			<LinkButton href="/myaccount/notifications">{t("openSettings")}</LinkButton>
		</EmptyState>
	);
}
