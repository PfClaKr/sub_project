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
import { useTranslations } from "next-intl";

// post sends JSON to the loginserver from the browser (so its Set-Cookie
// applies) and returns the error message, or "" on success.
async function post(path: string, body: unknown, t: (key: "requestError" | "serverError") => string): Promise<string> {
	try {
		const res = await fetch(`${LOGIN_URL}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			credentials: "include",
		});
		if (res.ok) return "";
		const json = await res.json().catch(() => null);
		return json?.error ?? t("requestError");
	} catch {
		return t("serverError");
	}
}

// ForgotForm asks for the address and always shows the same answer, as
// the server does, so it never tells whether an account exists.
export function ForgotForm() {
	const t = useTranslations("auth");
	const [sentTo, setSentTo] = useState("");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
		setBusy(true);
		setError("");
		const err = await post("/password/forgot", { email }, t);
		setBusy(false);
		if (err) setError(err);
		else setSentTo(email);
	};

	if (sentTo) {
		return (
			<div role="status">
				<MailCheck size={36} color={palette.primary} aria-hidden />
				<p>{t.rich("forgotSent", { email: sentTo, strong: chunks => <strong>{chunks}</strong> })}</p>
				<Muted as="p">{t("forgotSpam")}</Muted>
				<FormFooter><Link href="/login">{t("backToLogin")}</Link></FormFooter>
			</div>
		);
	}
	return (
		<FormColumn onSubmit={submit}>
			<FieldLabel>{t("email")}
				<input type="email" name="email" autoComplete="email" required />
			</FieldLabel>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<button type="submit" disabled={busy}>{busy ? t("sending") : t("getLink")}</button>
		</FormColumn>
	);
}

// ResetForm sets the new password from the mailed link and logs in.
export function ResetForm({ email, token }: { email: string; token: string }) {
	const t = useTranslations("auth");
	const router = useRouter();
	const { refresh } = useSession();
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	if (!email || !token) {
		return (
			<>
				<ErrorText role="alert">{t("badLink")}</ErrorText>
				<FormFooter><Link href="/account/forgot">{t("requestAgain")}</Link></FormFooter>
			</>
		);
	}

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		const password = String(form.get("password") ?? "");
		if (password !== form.get("passwordConfirm")) {
			setError(t("passwordsDiffer"));
			return;
		}
		setBusy(true);
		setError("");
		const err = await post("/password/reset", { email, token, password }, t);
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
			<FieldLabel>{t("newPassword")}
				<Hint>{t("passwordHint")}</Hint>
				<PasswordInput name="password" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			<FieldLabel>{t("newPasswordConfirm")}
				<PasswordInput name="passwordConfirm" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			{error && (
				<ErrorText role="alert">
					{error}{" "}
					{error.includes("만료") && <Link href="/account/forgot">{t("again")}</Link>}
				</ErrorText>
			)}
			<button type="submit" disabled={busy}>{busy ? t("changing") : t("setPassword")}</button>
		</FormColumn>
	);
}

// ChangePasswordForm is the logged-in variant on the account page.
export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
	const t = useTranslations("auth");
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);

	const submit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formEl = e.currentTarget;
		const form = new FormData(formEl);
		const password = String(form.get("password") ?? "");
		if (password !== form.get("passwordConfirm")) {
			setError(t("passwordsDiffer"));
			return;
		}
		setBusy(true);
		setError("");
		const err = await post("/password/change", { current: form.get("current"), password }, t);
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
			<FieldLabel>{t("currentPassword")}
				<PasswordInput name="current" autoComplete="current-password" required />
			</FieldLabel>
			<FieldLabel>{t("newPassword")}
				<Hint>{t("passwordHint")}</Hint>
				<PasswordInput name="password" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			<FieldLabel>{t("newPasswordConfirm")}
				<PasswordInput name="passwordConfirm" autoComplete="new-password" required minLength={8} maxLength={72} />
			</FieldLabel>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<button type="submit" disabled={busy}>{busy ? t("changing") : t("changePassword")}</button>
		</FormColumn>
	);
}
