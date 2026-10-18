import Link from "next/link";
import { LangLink, LegalArticle, LegalNav, Missing } from "@/styles/styledLegal";
import { legalDate, type LegalLang } from "@/libs/legal";

type Doc = "terms" | "privacy" | "legal";

const DOCS: { key: Doc; href: string; ko: string; fr: string }[] = [
	{ key: "terms", href: "/terms", ko: "이용약관", fr: "Conditions d'utilisation" },
	{ key: "privacy", href: "/privacy", ko: "개인정보처리방침", fr: "Politique de confidentialité" },
	{ key: "legal", href: "/legal", ko: "운영자 정보", fr: "Mentions légales" },
];

// LegalShell: document switcher, 한국어/Français toggle (?lang=fr) and
// the date in force.
export function LegalShell({ doc, lang, title, children }: { doc: Doc; lang: LegalLang; title: string; children: React.ReactNode }) {
	const href = DOCS.find(d => d.key === doc)!.href;
	return (
		<LegalArticle lang={lang}>
			<LegalNav aria-label={lang === "ko" ? "약관과 정책" : "Documents"}>
				<div className="docs">
					{DOCS.map(d => (
						<Link key={d.key} href={`${d.href}?lang=${lang}`} aria-current={d.key === doc ? "page" : undefined}>
							{d[lang]}
						</Link>
					))}
				</div>
				<div className="langs" role="group" aria-label="언어 / Langue">
					<LangLink href={`${href}?lang=ko`} $on={lang === "ko"} hrefLang="ko">한국어</LangLink>
					<LangLink href={`${href}?lang=fr`} $on={lang === "fr"} hrefLang="fr">Français</LangLink>
				</div>
			</LegalNav>
			<h1>{title}</h1>
			<p className="updated">{lang === "ko" ? `시행일: ${legalDate("ko")}` : `En vigueur au ${legalDate("fr")}`}</p>
			{children}
		</LegalArticle>
	);
}

// Fill shows an operator detail, or a visible placeholder while empty.
export function Fill({ value, lang, label }: { value: string; lang: LegalLang; label?: string }) {
	if (value) return <>{value}</>;
	return <Missing>{label ? `${label} ` : ""}{lang === "ko" ? "(입력 필요)" : "(à compléter)"}</Missing>;
}
