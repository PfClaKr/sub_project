import "server-only";
import { API_URL } from "@/libs/config";
import { DEFAULT_SETTINGS, type SiteData } from "./site";

// getSite reads the admin-edited content for a language. Cached for 30 s
// and tagged "site": saving on /admin/site revalidates it at once
// (app/api/site/revalidate). The site keeps working with its built-in
// texts when the API is down.
export async function getSite(locale: string): Promise<SiteData> {
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
}
