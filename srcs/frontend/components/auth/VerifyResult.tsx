'use client';

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { LOGIN_URL } from "@/libs/config";
import { AuthCard, FormFooter } from "@/styles/styledForm";
import { LinkButton, Skeleton } from "@/styles/styledUi";
import palette from "@/theme/colorPalette";
import { useTranslations } from "next-intl";

type State = "loading" | "ok" | "error";

// Activates the account from the mailed link. The server treats repeated
// calls for a verified account as success, so opening the link twice is fine.
export const VerifyResult = ({ token }: { token?: string }) => {
	const t = useTranslations("auth");
	const nav = useTranslations("nav");
	const footer = useTranslations("footer");
	const [state, setState] = useState<State>("loading");
	const [message, setMessage] = useState("");
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		if (!token) {
			setState("error");
			setMessage(t("verifyBadLink"));
			return;
		}
		fetch(`${LOGIN_URL}/verify?token=${encodeURIComponent(token)}`)
			.then(async res => {
				if (!res.ok) throw new Error(t("verifyExpired"));
				setState("ok");
			})
			.catch(e => {
				setState("error");
				setMessage(e instanceof Error ? e.message : t("verifyError"));
			});
	}, [token, t]);

	if (state === "loading") {
		return <AuthCard><h1>{t("verifying")}</h1><Skeleton $h="40px" /></AuthCard>;
	}
	return (
		<AuthCard>
			{state === "ok"
				? <CheckCircle2 size={40} style={{ color: palette.primary }} aria-hidden />
				: <XCircle size={40} style={{ color: palette.danger }} aria-hidden />}
			<h1>{state === "ok" ? t("verified") : t("verifyError")}</h1>
			<p>{state === "ok" ? t("verifiedBody") : message}</p>
			<LinkButton href="/login" style={{ display: "block" }}>{t("goLogin")}</LinkButton>
			<FormFooter>{nav("brand")} · {footer("tagline")}</FormFooter>
		</AuthCard>
	);
};
