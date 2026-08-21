'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthWrap, AuthCard, AuthTitle, AuthSubtitle } from "@/styles/styledAuth";
import { LOGIN_URL } from "@/libs/config";

type State = "loading" | "ok" | "error";

export const VerifyResult = ({ token }: { token?: string }) => {
	const [state, setState] = useState<State>("loading");
	const [message, setMessage] = useState("");

	useEffect(() => {
		if (!token) {
			setState("error");
			setMessage("인증 링크가 올바르지 않아요.");
			return;
		}
		fetch(`${LOGIN_URL}/verify?token=${encodeURIComponent(token)}`)
			.then(async res => {
				const json = await res.json().catch(() => null);
				if (!res.ok) throw new Error(json?.error ?? "인증에 실패했어요.");
				setState("ok");
			})
			.catch(e => {
				setState("error");
				setMessage(e.message);
			});
	}, [token]);

	return (
		<AuthWrap>
			<AuthCard>
				{state === "loading" && <AuthTitle>인증 중...</AuthTitle>}
				{state === "ok" && (
					<>
						<AuthTitle>이메일 인증 완료 🎉</AuthTitle>
						<AuthSubtitle>이제 로그인하고 잇냥을 이용할 수 있어요.</AuthSubtitle>
						<Link href="/login">로그인하러 가기</Link>
					</>
				)}
				{state === "error" && (
					<>
						<AuthTitle>인증하지 못했어요</AuthTitle>
						<AuthSubtitle>{message}</AuthSubtitle>
						<Link href="/account/sign-up">다시 가입하기</Link>
					</>
				)}
			</AuthCard>
		</AuthWrap>
	);
};
