'use client';

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LOGIN_URL } from "@/libs/config";
import { useSession } from "@/libs/session";
import { FormColumn, FieldLabel } from "@/styles/styledForm";
import { ErrorText } from "@/styles/styledUi";
import { safeNext } from "@/libs/redirect";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { PasswordInput } from "./PasswordInput";
import { useTranslations } from "next-intl";

// Runs in the browser so the loginserver's Set-Cookie reaches it.
export const SignInForm = ({ next }: { next?: string }) => {
	const t = useTranslations("auth");
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
				setError(json?.error ?? t("loginError"));
				return;
			}
			await refresh();
			router.push(safeNext(next));
		} catch {
			setError(t("serverError"));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={handleSubmit}>
			<FieldLabel>{t("email")}
				<input type="email" name="email" autoComplete="email" required />
			</FieldLabel>
			<FieldLabel>{t("password")}
				<PasswordInput name="password" autoComplete="current-password" required />
			</FieldLabel>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			{unverified && <ResendVerification email={unverified} />}
			<button type="submit" disabled={submitting}>{submitting ? t("loggingIn") : t("login")}</button>
		</FormColumn>
	);
};
