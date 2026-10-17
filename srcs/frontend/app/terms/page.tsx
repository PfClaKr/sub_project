import { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { TermsKo } from "@/components/legal/TermsKo";
import { TermsFr } from "@/components/legal/TermsFr";
import { legalLang } from "@/libs/legal";

type Props = { searchParams: { lang?: string } };

export function generateMetadata({ searchParams }: Props): Metadata {
	return { title: legalLang(searchParams.lang) === "fr" ? "Conditions générales d'utilisation" : "이용약관" };
}

export default function Page({ searchParams }: Props) {
	const lang = legalLang(searchParams.lang);
	return lang === "fr"
		? <LegalShell doc="terms" lang="fr" title="Conditions générales d'utilisation"><TermsFr /></LegalShell>
		: <LegalShell doc="terms" lang="ko" title="이용약관"><TermsKo /></LegalShell>;
}
