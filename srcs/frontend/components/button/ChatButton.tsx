'use client';

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CHAT_URL } from "@/libs/config";
import { ErrorText } from "@/styles/styledUi";

// ChatButton opens (or creates) the viewer's chat room about a product or
// a housing/job post.
export const ChatButton = ({ productId, subject, disabled, disabledLabel, label }: {
	productId?: string;
	subject?: { type: "product" | "housing" | "job"; id: string };
	disabled?: boolean;
	disabledLabel?: string;
	label?: string;
}) => {
	const t = useTranslations("chatButton");
	const target = subject ?? { type: "product" as const, id: productId ?? "" };
	const router = useRouter();
	const pathname = usePathname();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleClick = async () => {
		setLoading(true);
		setError("");
		try {
			const res = await fetch(`${CHAT_URL}/room/${target.type}/${encodeURIComponent(target.id)}`, { credentials: "include" });
			if (res.status === 401) {
				router.push(`/login?next=${encodeURIComponent(pathname)}`);
				return;
			}
			const json = await res.json().catch(() => null);
			if (!res.ok) {
				setError(json?.error ?? t("error"));
				return;
			}
			router.push(`/chat/${json.ChatId}`);
		} catch {
			setError(t("error"));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
			<button onClick={handleClick} disabled={loading || disabled}>
				{disabled ? disabledLabel ?? t("sold") : loading ? t("opening") : label ?? t("chat")}
			</button>
			{error && <ErrorText role="alert">{error}</ErrorText>}
		</div>
	);
};
