'use client';

import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/config";
import { useSession } from "@/libs/session";
import { formatDate } from "@/libs/format";
import { SuspendedBar } from "@/styles/styledNotification";

// Tells a suspended member why posting, chatting and uploading fail.
export function SuspendedBanner() {
	const t = useTranslations("suspended");
	const locale = useLocale() as Locale;
	const { session } = useSession();
	if (!session?.Suspended) return null;
	return (
		<SuspendedBar role="status">
			{session.SuspendedUntil ? t("messageUntil", { date: formatDate(session.SuspendedUntil, locale) }) : t("message")}
		</SuspendedBar>
	);
}
