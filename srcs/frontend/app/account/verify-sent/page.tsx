import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { AuthCard, FormFooter } from "@/styles/styledForm";
import palette from "@/theme/colorPalette";

export const generateMetadata = pageMetadata("pages.verifySent");

export default async function VerifySentPage({ searchParams }: { searchParams: { email?: string } }) {
	const email = searchParams.email ?? "";
	const t = await getTranslations("auth");
	return (
		<AuthCard>
			<MailCheck size={40} style={{ color: palette.primary }} aria-hidden />
			<h1>{t("checkMail")}</h1>
			<p>
				{email ? t.rich("sentTo", { email, strong: chunks => <strong>{chunks}</strong> }) : t("sentToAny")}
			</p>
			{email && <ResendVerification email={email} />}
			<FormFooter>
				{t("doneVerifying")} <Link href="/login">{t("loginNow")}</Link>
			</FormFooter>
		</AuthCard>
	);
}
