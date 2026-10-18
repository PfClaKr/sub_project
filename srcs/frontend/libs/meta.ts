import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// pageMetadata builds a page's generateMetadata from <key>.title and,
// when present, <key>.description in the messages:
//   export const generateMetadata = pageMetadata("pages.community");
export function pageMetadata(key: string) {
	return async function generateMetadata(): Promise<Metadata> {
		const t = await getTranslations(key);
		return { title: t("title"), ...(t.has("description") ? { description: t("description") } : {}) };
	};
}
