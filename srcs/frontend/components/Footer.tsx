'use client';

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { FooterBar, FooterLegal, FooterLinks } from "@/styles/styledLayout";
import { SECTIONS } from "@/libs/sections";

export default function Footer() {
	const t = useTranslations("footer");
	const nav = useTranslations("nav");
	return (
		<FooterBar>
			<FooterLinks aria-label={t("siteMenu")}>
				{SECTIONS.map(s => <Link key={s.href} href={s.href}>{nav(s.key)}</Link>)}
				<Link href="/sell">{t("sell")}</Link>
				<Link href="/safety">{t("safety")}</Link>
			</FooterLinks>
			<FooterLegal aria-label={t("legalMenu")}>
				<Link href="/terms">{t("terms")}</Link>
				<Link href="/privacy"><strong>{t("privacy")}</strong></Link>
				<Link href="/legal">{t("legal")}</Link>
			</FooterLegal>
			<p><strong>{nav("brand")}</strong> · {t("tagline")}</p>
			<p>{t("safetyNote")}</p>
			<LanguageSwitcher />
		</FooterBar>
	);
}
