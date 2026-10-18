import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, isLocale, pickLocale, type Locale } from "./config";
import { applyOverrides } from "@/libs/site";
import { getSite } from "@/libs/site.server";

// The locale comes from the visitor's saved choice, else the browser's
// languages. URLs stay the same in every language.
export default getRequestConfig(async () => {
	const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
	const locale: Locale = isLocale(saved) ? saved : pickLocale((await headers()).get("accept-language"));
	// Built-in texts with the admins' overrides (/admin/site) written in.
	const [messages, site] = await Promise.all([import(`../messages/${locale}.json`).then(m => m.default), getSite(locale)]);
	return {
		locale,
		messages: applyOverrides(messages, site.Texts),
		timeZone: "Europe/Paris",
	};
});
