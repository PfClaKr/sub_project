import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import Link from "next/link";
import { SignInForm } from "@/components/form/SignInForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AuthCard, FormFooter } from "@/styles/styledForm";
import { ErrorText } from "@/styles/styledUi";

export const generateMetadata = pageMetadata("pages.login");

export default async function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
	const t = await getTranslations("auth");
	const oauthError = searchParams.error?.startsWith("oauth_")
		? t(searchParams.error === "oauth_user" ? "oauthUser" : "oauthFailed")
		: "";
	return (
		<AuthCard>
			<h1>{t("loginTitle")}</h1>
			<p>{t("welcomeBack")}</p>
			{oauthError && <ErrorText role="alert" style={{ marginBottom: 12 }}>{oauthError}</ErrorText>}
			<GoogleButton label={t("google")} />
			<SignInForm next={searchParams.next} />
			<FormFooter style={{ marginTop: 12 }}>
				<Link href="/account/forgot">{t("forgot")}</Link>
			</FormFooter>
			<FormFooter style={{ marginTop: 8 }}>
				{t("noAccount")} <Link href="/account/sign-up">{t("signup")}</Link>
			</FormFooter>
		</AuthCard>
	);
}
