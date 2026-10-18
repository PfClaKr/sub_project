import { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { LegalShell } from "@/components/legal/LegalShell";
import { LegalNotice } from "@/components/legal/LegalNotice";
import { legalLang } from "@/libs/legal";

type Props = { searchParams: { lang?: string } };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
	return { title: legalLang(searchParams.lang, await getLocale()) === "fr" ? "Mentions légales" : "운영자 정보" };
}

export default async function Page({ searchParams }: Props) {
	const lang = legalLang(searchParams.lang, await getLocale());
	return (
		<LegalShell doc="legal" lang={lang} title={lang === "fr" ? "Mentions légales" : "운영자 정보"}>
			<LegalNotice lang={lang} />
		</LegalShell>
	);
}
