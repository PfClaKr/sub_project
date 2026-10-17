'use client';

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { LOGIN_URL } from "@/libs/config";
import { useSession } from "@/libs/session";
import { FieldLabel, FormColumn, FormFooter, Hint } from "@/styles/styledForm";
import { ErrorText, Muted } from "@/styles/styledUi";
import { PasswordInput } from "@/components/form/PasswordInput";
import palette from "@/theme/colorPalette";

// post sends JSON to the loginserver from the browser (so its Set-Cookie
// applies) and returns the error message, or "" on success.
async function post(path: string, body: unknown): Promise<string> {
	try {
		const res = await fetch(`${LOGIN_URL}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			credentials: "include",
		});
		if (res.ok) return "";
		const json = await res.json().catch(() => null);
		return json?.error ?? "요청을 처리하지 못했어요.";
	} catch {
		return "서버에 연결하지 못했어요.";
	}
}

// ForgotForm asks for the address and always shows the same answer, as
// the server does, so it never tells whether an account exists.
export function ForgotForm() {
	const [sentTo, setSentTo] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
		setBusy(true);
		setError("");
		const err = await post("/password/forgot", { email });
		setBusy(false);
		if (err) setError(err);
		else setSentTo(email);
	};

	if (sentTo) {
		return (
			<div role="status">
				<MailCheck size={36} color={palette.primary} aria-hidden />
				<p><strong>{sentTo}</strong>로 가입된 계정이 있다면 비밀번호 재설정 링크를 보냈어요. 링크는 1시간 동안 쓸 수 있어요.</p>
				<Muted as="p">메일이 오지 않으면 스팸함을 확인하거나, 몇 분 뒤에 다시 요청해주세요.</Muted>
				<FormFooter><Link href="/login">로그인으로 돌아가기</Link></FormFooter>
			</div>
		);
	}
	return (
		<FormColumn onSubmit={submit}>
			<FieldLabel>이메일
				<input type="email" name="email" autoComplete="email" required />
			</FieldLabel>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<button type="submit" disabled={busy}>{busy ? "보내는 중..." : "재설정 링크 받기"}</button>
		</FormColumn>
	);
}

// ResetForm sets the new password from the mailed link and logs in.
export function ResetForm({ email, token }: { email: string; token: string }) {
	const router = useRouter();
	const { refresh } = useSession();
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	if (!email || !token) {
		return (
			<>
				<ErrorText role="alert">링크가 올바르지 않아요. 메일의 링크를 다시 눌러주세요.</ErrorText>
				<FormFooter><Link href="/account/forgot">비밀번호 찾기 다시 요청하기</Link></FormFooter>
			</>
		);
	}

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		const password = String(form.get("password") ?? "");
		if (password !== form.get("passwordConfirm")) {
			setError("두 비밀번호가 같지 않아요.");
			return;
		}
		setBusy(true);
		setError("");
		const err = await post("/password/reset", { email, token, password });
		setBusy(false);
		if (err) {
			setError(err);
			return;
		}
		await refresh();
		router.push("/myaccount?reset=1");
	};

	return (
		<FormColumn onSubmit={submit}>
			<Muted as="p" style={{ margin: 0 }}>{email}</Muted>
			<FieldLabel>새 비밀번호
				<Hint>8자 이상</Hint>
				<PasswordInput name="password" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			<FieldLabel>새 비밀번호 확인
				<PasswordInput name="passwordConfirm" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			{error && (
				<ErrorText role="alert">
					{error}{" "}
					{error.includes("만료") && <Link href="/account/forgot">다시 요청하기</Link>}
				</ErrorText>
			)}
			<button type="submit" disabled={busy}>{busy ? "바꾸는 중..." : "비밀번호 바꾸기"}</button>
		</FormColumn>
	);
}

// ChangePasswordForm is the logged-in variant on the account page.
export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formEl = e.currentTarget;
		const form = new FormData(formEl);
		const password = String(form.get("password") ?? "");
		if (password !== form.get("passwordConfirm")) {
			setError("두 비밀번호가 같지 않아요.");
			return;
		}
		setBusy(true);
		setError("");
		const err = await post("/password/change", { current: form.get("current"), password });
		setBusy(false);
		if (err) {
			setError(err);
			return;
		}
		formEl.reset();
		onDone();
	};

	return (
		<FormColumn onSubmit={submit} style={{ maxWidth: 420 }}>
			<FieldLabel>현재 비밀번호
				<PasswordInput name="current" autoComplete="current-password" required />
			</FieldLabel>
			<FieldLabel>새 비밀번호
				<Hint>8자 이상</Hint>
				<PasswordInput name="password" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			<FieldLabel>새 비밀번호 확인
				<PasswordInput name="passwordConfirm" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<button type="submit" disabled={busy}>{busy ? "바꾸는 중..." : "비밀번호 변경"}</button>
		</FormColumn>
	);
}
