import { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { LegalNotice } from "@/components/legal/LegalNotice";
import { legalLang } from "@/libs/legal";

type Props = { searchParams: { lang?: string } };

export function generateMetadata({ searchParams }: Props): Metadata {
	return { title: legalLang(searchParams.lang) === "fr" ? "Mentions légales" : "운영자 정보" };
}

export default function Page({ searchParams }: Props) {
	const lang = legalLang(searchParams.lang);
	return (
		<LegalShell doc="legal" lang={lang} title={lang === "fr" ? "Mentions légales" : "운영자 정보"}>
			<LegalNotice lang={lang} />
		</LegalShell>
	);
}
