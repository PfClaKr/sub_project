import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import Link from "next/link";
import { SignUpForm } from "@/components/form/SignUpForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AuthCard, FormFooter } from "@/styles/styledForm";

export const generateMetadata = pageMetadata("pages.signup");

export default async function AccountSignUpPage() {
	const t = await getTranslations("auth");
	return (
		<AuthCard>
			<h1>{t("signupTitle")}</h1>
			<p>{t("signupLead")}</p>
			<GoogleButton label={t("googleStart")} />
			<SignUpForm />
			<FormFooter>
				{t("haveAccount")} <Link href="/login">{t("login")}</Link>
			</FormFooter>
		</AuthCard>
	);
}
