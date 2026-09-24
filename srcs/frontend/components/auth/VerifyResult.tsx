'use client';

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { LOGIN_URL } from "@/libs/config";
import { AuthCard, FormFooter } from "@/styles/styledForm";
import { LinkButton, Skeleton } from "@/styles/styledUi";
import palette from "@/theme/colorPalette";

type State = "loading" | "ok" | "error";

// Activates the account from the mailed link. The server treats repeated
// calls for a verified account as success, so opening the link twice is fine.
export const VerifyResult = ({ token }: { token?: string }) => {
	const [state, setState] = useState<State>("loading");
	const [message, setMessage] = useState("");
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		if (!token) {
			setState("error");
			setMessage("인증 링크가 올바르지 않아요.");
			return;
		}
		fetch(`${LOGIN_URL}/verify?token=${encodeURIComponent(token)}`)
			.then(async res => {
				if (!res.ok) throw new Error("링크가 만료되었거나 올바르지 않아요. 로그인 화면에서 인증 메일을 다시 받을 수 있어요.");
				setState("ok");
			})
			.catch(e => {
				setState("error");
				setMessage(e instanceof Error ? e.message : "인증하지 못했어요.");
			});
	}, [token]);

	if (state === "loading") {
		return <AuthCard><h1>인증하는 중...</h1><Skeleton $h="40px" /></AuthCard>;
	}
	return (
		<AuthCard>
			{state === "ok"
				? <CheckCircle2 size={40} color={palette.primary} aria-hidden />
				: <XCircle size={40} color={palette.danger} aria-hidden />}
			<h1>{state === "ok" ? "이메일 인증 완료" : "인증하지 못했어요"}</h1>
			<p>{state === "ok" ? "이제 로그인하고 잇냥을 이용할 수 있어요." : message}</p>
			<LinkButton href="/login" style={{ display: "block" }}>로그인하러 가기</LinkButton>
			<FormFooter>잇냥 · 파리 한인 중고마켓</FormFooter>
		</AuthCard>
	);
};
