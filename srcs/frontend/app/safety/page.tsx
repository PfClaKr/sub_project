import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader, Section, SectionTitle } from "@/styles/styledLayout";
import { SafetyList } from "@/components/listing/SafetyList";
import { pageMetadata } from "@/libs/meta";

export const generateMetadata = pageMetadata("safety");

const SECTIONS = ["housing", "jobs", "market", "help"] as const;

// Static guide linked from every housing/job page. Contacts checked on
// the official sites on 2026-10-17 (embassy numbers from its home page);
// re-check them when the guide changes. Texts: safety.<section>.items.<n>.
export default async function Page() {
	const t = await getTranslations("safety");
	const items = (section: string): [string, string][] => {
		const out: [string, string][] = [];
		for (let i = 1; t.has(`${section}.items.${i}.title`); i++) {
			out.push([t(`${section}.items.${i}.title`), t(`${section}.items.${i}.body`)]);
		}
		return out;
	};
	return (
		<div style={{ maxWidth: 760 }}>
			<PageHeader>
				<h1>{t("title")}</h1>
				<p>{t("lead")}</p>
			</PageHeader>

			{SECTIONS.map(section => (
				<Section key={section}>
					<SectionTitle>{t(`${section}.title`)}</SectionTitle>
					<SafetyList items={items(section)} />
					{section === "help" && (
						<p style={{ marginTop: 16 }}>
							<a href="https://www.17cyber.gouv.fr" target="_blank" rel="noopener noreferrer">17Cyber</a>
							{" · "}
							<a href="https://www.internet-signalement.gouv.fr" target="_blank" rel="noopener noreferrer">PHAROS</a>
							{" · "}
							<a href="https://www.cybermalveillance.gouv.fr" target="_blank" rel="noopener noreferrer">cybermalveillance.gouv.fr</a>
							{" · "}
							<a href="https://overseas.mofa.go.kr/fr-ko/index.do" target="_blank" rel="noopener noreferrer">{t("embassy")}</a>
							{" · "}
							<Link href="/community?board=qna">{t("ask")}</Link>
						</p>
					)}
				</Section>
			))}
		</div>
	);
}
