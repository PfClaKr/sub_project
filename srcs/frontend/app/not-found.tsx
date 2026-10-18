import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CatMascot } from "@/components/landing/CatMascot";
import { Chip, EmptyState, LinkButton } from "@/styles/styledUi";
import { Row } from "@/styles/styledLayout";
import { SECTIONS } from "@/libs/sections";

export async function generateMetadata(): Promise<Metadata> {
	return { title: (await getTranslations("notFound"))("title") };
}

export default async function NotFound() {
	const t = await getTranslations("notFound");
	const nav = await getTranslations("nav");
	return (
		<EmptyState style={{ marginTop: 24 }}>
			<div style={{ width: 140, height: 140, margin: "0 auto" }} aria-hidden="true"><CatMascot /></div>
			<h1 style={{ fontSize: 22, margin: "12px 0 4px" }}>{t("title")}</h1>
			<p>{t("body")}</p>
			<Row style={{ justifyContent: "center", flexWrap: "wrap", gap: 8, margin: "4px 0 16px" }}>
				{SECTIONS.map(s => <Chip key={s.href} href={s.href}>{nav(s.key)}</Chip>)}
			</Row>
			<LinkButton href="/">{t("home")}</LinkButton>
		</EmptyState>
	);
}
