import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { currentSession } from "@/libs/adminApi";
import { AdminFrame, AdminShell } from "@/styles/styledAdmin";
import { PageHeader } from "@/styles/styledLayout";
import { EmptyState, LinkButton } from "@/styles/styledUi";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("admin");
	return { title: { template: t("titleTemplate"), default: t("title") }, robots: { index: false } };
}

// The layout only decides what to render; the admin API checks the role
// again on every request.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const t = await getTranslations("admin");
	const session = await currentSession();
	if (!session) redirect("/login?next=/admin");

	if (session.Role !== "admin") {
		return (
			<EmptyState>
				<p>{t.rich("forbidden", { strong: chunks => <strong>{chunks}</strong> })}</p>
				<LinkButton href="/">{t("home")}</LinkButton>
			</EmptyState>
		);
	}

	return (
		<AdminFrame>
			<PageHeader>
				<h1>{t("title")}</h1>
				<p>{t("loggedInAs", { name: session.UserNickname ?? "" })}</p>
			</PageHeader>
			<AdminShell>
				<AdminNav />
				<div>{children}</div>
			</AdminShell>
		</AdminFrame>
	);
}
