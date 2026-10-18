'use client';

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { LOCALES, LOCALE_COOKIE, LOCALE_LABELS, type Locale } from "@/i18n/config";
import { LanguageSelect } from "@/styles/styledLayout";
import { gql } from "@/libs/graphql";
import { useSession } from "@/libs/session";

// Saves the choice in a cookie (read by i18n/request.ts and the servers)
// for a year and re-renders the page in the new language. A logged-in
// member's choice is also saved on the account, for their mails and push.
export function setLocaleCookie(locale: Locale) {
	document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function LanguageSwitcher() {
	const t = useTranslations("footer");
	const locale = useLocale();
	const router = useRouter();
	const { session } = useSession();
	const [pending, start] = useTransition();

	return (
		<LanguageSelect>
			<Globe size={14} aria-hidden />
			<select
				aria-label={t("language")}
				value={locale}
				disabled={pending}
				onChange={e => {
					const next = e.target.value as Locale;
					setLocaleCookie(next);
					if (session) gql(`mutation($l: String!) { setLocale(Locale: $l) }`, { l: next });
					start(() => router.refresh());
				}}
			>
				{LOCALES.map(l => <option key={l} value={l} lang={l}>{LOCALE_LABELS[l]}</option>)}
			</select>
		</LanguageSelect>
	);
}
