'use client';

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LOGIN_URL } from "@/libs/config";
import { useSession } from "@/libs/session";
import { FormColumn, FieldLabel, Hint, TwoColumns } from "@/styles/styledForm";
import { DEFAULT_REGION, REGIONS } from "@/libs/constants";
import { ErrorText } from "@/styles/styledUi";
import { PasswordInput } from "./PasswordInput";
import Link from "next/link";
import { MIN_AGE } from "@/libs/legal";
import { ConsentRow } from "@/styles/styledForm";
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";

export const SignUpForm = () => {
	const t = useTranslations("auth");
	const L = useLabels();
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
			setError(t("passwordMismatch"));
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
					agree: form.get("agree") === "on",
				}),
				credentials: "include",
			});
			if (!res.ok) {
				const json = await res.json().catch(() => null);
				setError(json?.error ?? t("signupError"));
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
			setError(t("serverError"));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={handleSubmit}>
			<FieldLabel>{t("email")}
				<input
					type="email"
					name="email"
					autoComplete="email"
					required
					onBlur={e => checkEmail(e.target.value.trim())}
					onChange={() => setEmailTaken(false)}
					aria-invalid={emailTaken}
				/>
				{emailTaken && <ErrorText>{t("emailTaken")}</ErrorText>}
			</FieldLabel>
			<FieldLabel>{t("nickname")} <Hint>{t("nicknameHint")}</Hint>
				<input type="text" name="nickname" autoComplete="nickname" required minLength={2} maxLength={20} />
			</FieldLabel>
			<TwoColumns>
				<FieldLabel>{t("residence")}
					<select name="residence" defaultValue={DEFAULT_REGION} required>
						{REGIONS.map(r => <option key={r} value={r}>{L.enum("region", r)}</option>)}
					</select>
				</FieldLabel>
				<FieldLabel>{t("detail")} <Hint>{t("optional")}</Hint>
					<input type="text" name="residencedetail" maxLength={50} placeholder={t("detailPlaceholder")} />
				</FieldLabel>
			</TwoColumns>
			<FieldLabel>{t("password")} <Hint>{t("passwordHint")}</Hint>
				<PasswordInput name="password" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			<FieldLabel>{t("passwordConfirm")}
				<PasswordInput name="passwordConfirm" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			<ConsentRow>
				<input type="checkbox" name="agree" required />
				<span>
					{t.rich("consent", {
						age: MIN_AGE,
						terms: chunks => <Link href="/terms" target="_blank">{chunks}</Link>,
						privacy: chunks => <Link href="/privacy" target="_blank">{chunks}</Link>,
					})}
				</span>
			</ConsentRow>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<button type="submit" disabled={submitting || emailTaken}>{submitting ? t("signingUp") : t("submitSignup")}</button>
		</FormColumn>
	);
};
