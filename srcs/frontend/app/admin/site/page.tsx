import { getTranslations } from "next-intl/server";
import { SiteEditor, type AdminSite } from "@/components/admin/SiteEditor";
import { adminGet, isAdmin } from "@/libs/adminApi";
import { pageMetadata } from "@/libs/meta";
import { Panel } from "@/styles/styledAdmin";

export const generateMetadata = pageMetadata("admin.site");

export default async function AdminSitePage({ searchParams }: { searchParams: { tab?: string } }) {
	if (!(await isAdmin())) return null;
	const t = await getTranslations("admin.site");
	const data = await adminGet<AdminSite>("/site");
	return (
		<Panel>
			<h2>{t("title")}</h2>
			<p>{t("lead")}</p>
			<SiteEditor initial={data} tab={searchParams.tab} />
		</Panel>
	);
}
