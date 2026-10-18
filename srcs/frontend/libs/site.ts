import type { ColorToken } from "@/theme/colorPalette";

// What admins edit on /admin/site (apiserver sitehandler): text
// overrides per language and the settings below.
export type HomeSectionId = "purposes" | "checklist" | "feed" | "recent" | "trust";
export type SiteSettings = {
	Notice: { Enabled: boolean; Tone: "info" | "warning"; Link: string; Text: Record<string, string>; Version: number };
	Home: { Id: HomeSectionId; Enabled: boolean }[];
	Hero: string;
	Theme: Partial<Record<ColorToken, string>>;
};
// Preview is true when the content is an admin's unsaved draft.
export type SiteData = { Texts: Record<string, string>; Settings: SiteSettings; Preview?: boolean };

// While the editor's preview is open, this cookie (value: the preview's
// language) makes the site render the admin's draft (libs/site.server.ts).
export const PREVIEW_COOKIE = "itnyang.preview";
// Set by middleware.ts on /admin pages, which always show saved content.
export const ADMIN_PAGE_HEADER = "x-itnyang-admin-page";

export const DEFAULT_SETTINGS: SiteSettings = {
	Notice: { Enabled: false, Tone: "info", Link: "", Text: {}, Version: 0 },
	Home: (["purposes", "checklist", "feed", "recent", "trust"] as const).map(Id => ({ Id, Enabled: true })),
	Hero: "",
	Theme: {},
};

// applyOverrides returns messages with each "a.b.c" override written in.
// Keys the messages do not have are ignored, so a stale override cannot
// add text nobody reads.
export function applyOverrides<T extends Record<string, unknown>>(messages: T, overrides: Record<string, string>): T {
	const out = structuredClone(messages);
	for (const [path, text] of Object.entries(overrides)) {
		const keys = path.split(".");
		let node: Record<string, unknown> = out;
		for (const k of keys.slice(0, -1)) {
			const next = node[k];
			if (!next || typeof next !== "object") {
				node = {};
				break;
			}
			node = next as Record<string, unknown>;
		}
		const last = keys[keys.length - 1];
		if (typeof node[last] === "string" && text.trim()) node[last] = text;
	}
	return out;
}
