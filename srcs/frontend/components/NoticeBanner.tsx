'use client';

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Info, TriangleAlert, X } from "lucide-react";
import { NoticeBar } from "@/styles/styledLayout";

const KEY = "itnyang.notice";

// The prepaint script hides a notice this visitor already closed before
// React runs (same approach as the arrival checklist, libs/arrival.ts).
export function noticePrepaint(version: number): string {
	return `try{if(localStorage.getItem(${JSON.stringify(KEY)})===${JSON.stringify(String(version))})document.documentElement.setAttribute("data-notice-hidden","")}catch(e){}`;
}

// NoticeBanner: the site-wide announcement set on /admin/site. Closing it
// lasts until admins change its text (the version moves).
export function NoticeBanner({ text, tone, link, version }: { text: string; tone: "info" | "warning"; link: string; version: number }) {
	const t = useTranslations("notice");
	const close = () => {
		try {
			localStorage.setItem(KEY, String(version));
		} catch {
			// storage unavailable: closed for this page only
		}
		document.documentElement.setAttribute("data-notice-hidden", "");
	};
	const Icon = tone === "warning" ? TriangleAlert : Info;
	return (
		<>
			<script dangerouslySetInnerHTML={{ __html: noticePrepaint(version) }} />
			<NoticeBar $tone={tone} data-notice="" role="status">
				<Icon size={16} aria-hidden />
				<span>
					{text}
					{link && <>{" "}<Link href={link}>{t("more")}</Link></>}
				</span>
				<button type="button" onClick={close} aria-label={t("close")}><X size={16} aria-hidden /></button>
			</NoticeBar>
		</>
	);
}
