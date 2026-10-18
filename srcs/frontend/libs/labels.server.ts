import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";
import { makeLabels, type Labels, type T } from "./labels";

// getLabels is useLabels() for server components.
export async function getLabels(): Promise<Labels> {
	return makeLabels((await getTranslations()) as unknown as T, (await getLocale()) as Locale);
}
