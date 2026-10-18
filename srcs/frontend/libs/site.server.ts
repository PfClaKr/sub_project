import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { API_URL } from "@/libs/config";
import { isLocale, type Locale } from "@/i18n/config";
import { ADMIN_PAGE_HEADER, DEFAULT_SETTINGS, PREVIEW_COOKIE, type SiteData } from "./site";

// previewLocale is the language of an open editor preview, or null when
// this request shows saved content (no preview cookie, or an /admin page).
export function previewLocale(): Locale | null {
	const value = cookies().get(PREVIEW_COOKIE)?.value;
	if (!value || headers().get(ADMIN_PAGE_HEADER)) return null;
	return isLocale(value) ? value : null;
}

// An admin's draft (apiserver GET /admin/site/preview, never cached).
// Anyone else gets a 401/403 and the saved content.
async function getPreview(locale: string): Promise<SiteData | null> {
	const token = cookies().get("token")?.value;
	if (!token || !previewLocale()) return null;
	try {
		const res = await fetch(`${API_URL}/admin/site/preview?locale=${encodeURIComponent(locale)}`, {
			headers: { Cookie: `token=${token}` },
			cache: "no-store",
		});
		if (!res.ok) return null;
		const data = (await res.json()) as SiteData;
		return { Texts: data.Texts ?? {}, Settings: { ...DEFAULT_SETTINGS, ...data.Settings }, Preview: true };
	} catch {
		return null;
	}
}

// getSite reads the admin-edited content for a language. Cached for 30 s
// and tagged "site": saving on /admin/site revalidates it at once
// (app/api/site/revalidate). The site keeps working with its built-in
// texts when the API is down. Deduplicated per request (the locale
// config, the layout and the home page all ask).
export const getSite = cache(async (locale: string): Promise<SiteData> => {
	const preview = await getPreview(locale);
	if (preview) return preview;
	try {
		const res = await fetch(`${API_URL}/site?locale=${encodeURIComponent(locale)}`, {
			next: { revalidate: 30, tags: ["site"] },
		});
		if (!res.ok) throw new Error(String(res.status));
		const data = (await res.json()) as SiteData;
		return { Texts: data.Texts ?? {}, Settings: { ...DEFAULT_SETTINGS, ...data.Settings } };
	} catch {
		return { Texts: {}, Settings: DEFAULT_SETTINGS };
	}
});
