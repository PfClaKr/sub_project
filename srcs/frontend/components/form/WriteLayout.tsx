import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Lightbulb } from "lucide-react";
import { TipsCard, WriteGrid } from "@/styles/styledForm";

type Kind = "product" | "qna" | "free" | "housing" | "job";

// WriteLayout puts writing tips next to a form on wide screens.
// Texts: writeTips.<kind>.{title, item1…item4, safety}; a kind has as
// many items as its messages define.
export function WriteLayout({ kind, children }: { kind: Kind; children: React.ReactNode }) {
	const t = useTranslations("writeTips");
	const items = [1, 2, 3, 4].map(i => `${kind}.item${i}`).filter(key => t.has(key)).map(key => t(key));
	return (
		<WriteGrid>
			<div>{children}</div>
			<TipsCard aria-label={t("label")}>
				<h2><Lightbulb size={18} aria-hidden /> {t(`${kind}.title`)}</h2>
				<ul>
					{items.map(item => <li key={item}><Check size={15} aria-hidden />{item}</li>)}
				</ul>
				<p className="safety">{t(`${kind}.safety`)} <Link href="/safety">{t("guide")}</Link></p>
			</TipsCard>
		</WriteGrid>
	);
}
