'use client';

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LOGIN_URL } from "@/libs/config";
import { useSession } from "@/libs/session";
import { FormColumn, FieldLabel } from "@/styles/styledForm";
import { ErrorText } from "@/styles/styledUi";
import { safeNext } from "@/libs/redirect";
import { ResendVerification } from "@/components/auth/ResendVerification";

// Runs in the browser so the loginserver's Set-Cookie reaches it.
export const SignInForm = ({ next }: { next?: string }) => {
	const router = useRouter();
	const { refresh } = useSession();
	const [error, setError] = useState("");
	const [unverified, setUnverified] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		setUnverified("");
		setSubmitting(true);
		const form = new FormData(event.currentTarget);
		try {
			const res = await fetch(`${LOGIN_URL}/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
				credentials: "include",
			});
			if (!res.ok) {
				const json = await res.json().catch(() => null);
				if (json?.code === "EMAIL_NOT_VERIFIED") setUnverified(String(form.get("email") ?? ""));
				setError(json?.error ?? "로그인하지 못했어요.");
				return;
			}
			await refresh();
			router.push(safeNext(next));
		} catch {
			setError("서버에 연결하지 못했어요.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={handleSubmit}>
			<FieldLabel>이메일
				<input type="email" name="email" autoComplete="email" required />
			</FieldLabel>
			<FieldLabel>비밀번호
				<input type="password" name="password" autoComplete="current-password" required />
			</FieldLabel>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			{unverified && <ResendVerification email={unverified} />}
			<button type="submit" disabled={submitting}>{submitting ? "로그인 중..." : "로그인"}</button>
		</FormColumn>
	);
};
