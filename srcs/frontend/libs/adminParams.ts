// Query-string plumbing shared by the admin lists (ported from the
// ineverywhere admin): every control must keep the others, and any
// filter change returns to page 1 so the admin never lands on an empty
// page of a result set that just shrank.
export type SearchParams = Record<string, string | string[] | undefined>;

export function param(params: SearchParams, key: string): string {
	const v = params[key];
	return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export function buildAdminHref(pathname: string, params: SearchParams, changes: Record<string, string | null>): string {
	const next = new URLSearchParams();
	for (const key of Object.keys(params)) {
		const v = param(params, key);
		if (v) next.set(key, v);
	}
	for (const [key, value] of Object.entries(changes)) {
		if (value) next.set(key, value);
		else next.delete(key);
	}
	if (!("page" in changes)) next.delete("page");
	const q = next.toString();
	return q ? `${pathname}?${q}` : pathname;
}

// Forwards only the listed filters to the admin API.
export function apiQuery(params: SearchParams, keys: string[]): string {
	const q = new URLSearchParams();
	for (const k of keys) {
		const v = param(params, k);
		if (v) q.set(k, v);
	}
	const s = q.toString();
	return s ? `?${s}` : "";
}
