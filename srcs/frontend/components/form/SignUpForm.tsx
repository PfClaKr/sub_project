'use client';

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LOGIN_URL } from "@/libs/config";
import { useSession } from "@/libs/session";
import { FormColumn, FieldLabel, Hint, TwoColumns } from "@/styles/styledForm";
import { DEFAULT_REGION, REGIONS } from "@/libs/constants";
import { ErrorText } from "@/styles/styledUi";

export const SignUpForm = () => {
	const router = useRouter();
	const { refresh } = useSession();
	const [error, setError] = useState("");
	const [emailTaken, setEmailTaken] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	const checkEmail = async (email: string) => {
		if (!email) return;
		try {
			const res = await fetch(`${LOGIN_URL}/emailcheck?email=${encodeURIComponent(email)}`);
			if (res.ok) setEmailTaken(!(await res.json()).available);
		} catch {
			// The signup request reports conflicts anyway.
		}
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		const form = new FormData(event.currentTarget);
		if (form.get("password") !== form.get("passwordConfirm")) {
			setError("비밀번호가 서로 달라요.");
			return;
		}
		setSubmitting(true);
		try {
			const res = await fetch(`${LOGIN_URL}/signup`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: form.get("email"),
					password: form.get("password"),
					usernickname: form.get("nickname"),
					residence: form.get("residence"),
					residencedetail: form.get("residencedetail"),
				}),
				credentials: "include",
			});
			if (!res.ok) {
				const json = await res.json().catch(() => null);
				setError(json?.error ?? "가입하지 못했어요.");
				return;
			}
			const json = await res.json().catch(() => null);
			// With email verification on, the user logs in after clicking
			// the mailed link; otherwise the loginserver already logged in.
			if (json?.next === "verify-email") {
				router.push(`/account/verify-sent?email=${encodeURIComponent(String(form.get("email") ?? ""))}`);
				return;
			}
			await refresh();
			router.push("/");
		} catch {
			setError("서버에 연결하지 못했어요.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={handleSubmit}>
			<FieldLabel>이메일
				<input
					type="email"
					name="email"
					autoComplete="email"
					required
					onBlur={e => checkEmail(e.target.value.trim())}
					onChange={() => setEmailTaken(false)}
					aria-invalid={emailTaken}
				/>
				{emailTaken && <ErrorText>이미 사용 중인 이메일이에요.</ErrorText>}
			</FieldLabel>
			<FieldLabel>닉네임 <Hint>2~20자</Hint>
				<input type="text" name="nickname" autoComplete="nickname" required minLength={2} maxLength={20} />
			</FieldLabel>
			<TwoColumns>
				<FieldLabel>사는 곳
					<select name="residence" defaultValue={DEFAULT_REGION} required>
						{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
					</select>
				</FieldLabel>
				<FieldLabel>상세 <Hint>선택</Hint>
					<input type="text" name="residencedetail" maxLength={50} placeholder="예: 15구, Cachan" />
				</FieldLabel>
			</TwoColumns>
			<FieldLabel>비밀번호 <Hint>8자 이상</Hint>
				<input type="password" name="password" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			<FieldLabel>비밀번호 확인
				<input type="password" name="passwordConfirm" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<button type="submit" disabled={submitting || emailTaken}>{submitting ? "가입 중..." : "가입하기"}</button>
		</FormColumn>
	);
};
