import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetForm } from "@/components/auth/PasswordForms";
import { AuthCard } from "@/styles/styledForm";

export async function generateMetadata(): Promise<Metadata> {
	return { title: (await getTranslations("pages.reset"))("title"), robots: { index: false } };
}

export default async function Page({ searchParams }: { searchParams: { email?: string; token?: string } }) {
	const t = await getTranslations("auth");
	return (
		<AuthCard>
			<h1>{t("resetTitle")}</h1>
			<p>{t("resetLead")}</p>
			<ResetForm email={searchParams.email ?? ""} token={searchParams.token ?? ""} />
		</AuthCard>
	);
}
