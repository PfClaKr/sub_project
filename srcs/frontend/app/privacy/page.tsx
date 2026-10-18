import { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import { PrivacyKo } from "@/components/legal/PrivacyKo";
import { PrivacyFr } from "@/components/legal/PrivacyFr";
import { legalLang } from "@/libs/legal";

type Props = { searchParams: { lang?: string } };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
	return { title: legalLang(searchParams.lang, await getLocale()) === "fr" ? "Politique de confidentialité" : "개인정보처리방침" };
}

export default async function Page({ searchParams }: Props) {
	const lang = legalLang(searchParams.lang, await getLocale());
	return lang === "fr"
		? <LegalShell doc="privacy" lang="fr" title="Politique de confidentialité"><PrivacyFr /></LegalShell>
		: <LegalShell doc="privacy" lang="ko" title="개인정보처리방침"><PrivacyKo /></LegalShell>;
}
