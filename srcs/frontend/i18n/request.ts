import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, isLocale, pickLocale, type Locale } from "./config";

// The locale comes from the visitor's saved choice, else the browser's
// languages. URLs stay the same in every language.
export default getRequestConfig(async () => {
	const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
	const locale: Locale = isLocale(saved) ? saved : pickLocale((await headers()).get("accept-language"));
	return {
		locale,
		messages: (await import(`../messages/${locale}.json`)).default,
		timeZone: "Europe/Paris",
	};
});
