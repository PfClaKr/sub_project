'use client';

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormColumn, FieldLabel, ErrorText } from "@/styles/styledForm";
import { LOGIN_URL } from "@/libs/config";

const OAUTH_ERRORS: Record<string, string> = {
	oauth_state: "인증 상태가 만료됐어요. 다시 시도해주세요.",
	oauth_code: "구글 로그인이 취소됐어요.",
	oauth_token: "구글 인증에 실패했어요.",
	oauth_user: "구글 계정 정보를 가져오지 못했어요.",
	oauth_account: "계정을 만들지 못했어요.",
	oauth_session: "세션을 만들지 못했어요.",
};

export const SignInForm = () => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const oauthError = searchParams.get("error");

	const [error, setError] = useState(oauthError ? OAUTH_ERRORS[oauthError] ?? "로그인에 실패했어요." : "");
	const [unverifiedEmail, setUnverifiedEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [resent, setResent] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		setUnverifiedEmail("");
		setResent(false);
		setSubmitting(true);

		const formData = new FormData(event.currentTarget);
		const email = String(formData.get("email") ?? "");

		try {
			const res = await fetch(`${LOGIN_URL}/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ Email: email, Password: formData.get("password") }),
				credentials: 'include',
			});

			if (res.ok) {
				router.push('/');
				router.refresh();
				return;
			}

			const json = await res.json().catch(() => null);
			if (json?.code === "EMAIL_NOT_VERIFIED") {
				setUnverifiedEmail(email);
				setError("이메일 인증이 아직 완료되지 않았어요.");
				return;
			}
			setError("이메일 또는 비밀번호가 올바르지 않아요.");
		} catch {
			setError("로그인 중 문제가 발생했어요.");
		} finally {
			setSubmitting(false);
		}
	};

	const handleResend = async () => {
		await fetch(`${LOGIN_URL}/verify/resend?email=${encodeURIComponent(unverifiedEmail)}`, {
			method: 'POST',
		});
		setResent(true);
	};

	return (
		<FormColumn onSubmit={handleSubmit}>
			<FieldLabel>이메일
				<input type="email" placeholder="you@example.com" name="email" required />
			</FieldLabel>
			<FieldLabel>비밀번호
				<input type="password" placeholder="비밀번호" name="password" required />
			</FieldLabel>
			{error && <ErrorText>{error}</ErrorText>}
			{unverifiedEmail && !resent && (
				<button type="button" onClick={handleResend}>인증 메일 다시 보내기</button>
			)}
			{resent && <p>인증 메일을 다시 보냈어요. 메일함을 확인해주세요.</p>}
			<button type="submit" disabled={submitting}>
				{submitting ? "로그인 중..." : "로그인"}
			</button>
		</FormColumn>
	);
};
