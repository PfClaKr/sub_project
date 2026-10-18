import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { ForgotForm } from "@/components/auth/PasswordForms";
import { AuthCard } from "@/styles/styledForm";

export const generateMetadata = pageMetadata("pages.forgot");

export default async function Page() {
	const t = await getTranslations("auth");
	return (
		<AuthCard>
			<h1>{t("forgotTitle")}</h1>
			<p>{t("forgotLead")}</p>
			<ForgotForm />
		</AuthCard>
	);
}
