import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { API_URL, LOGIN_URL } from "@/libs/config";
import type { Session } from "@/libs/types";

// Server components have no browser cookie jar; forward the session
// cookie to the backend explicitly. (Cookies are per host, not per port,
// so the login server's cookie reaches the Next server on localhost.)
function cookieHeader(): Record<string, string> {
	const token = cookies().get("token")?.value;
	return token ? { Cookie: `token=${token}` } : {};
}

export type AdminPage<T> = { Items: T[]; Page: number; TotalPages: number; Total: number };

export async function adminGet<T>(path: string): Promise<T> {
	const res = await fetch(`${API_URL}/admin${path}`, { headers: cookieHeader(), cache: "no-store" });
	if (!res.ok) throw new Error(`admin API ${path}: ${res.status}`);
	return res.json();
}

// Cached per request: the admin layout and page both ask.
export const currentSession = cache(async (): Promise<Session | null> => {
	try {
		const res = await fetch(`${LOGIN_URL}/whoami`, { headers: cookieHeader(), cache: "no-store" });
		return res.ok ? res.json() : null;
	} catch {
		return null;
	}
});

// Next renders a layout and its page in parallel, so a page cannot rely
// on the layout's 403 screen to stop it; admin pages return early instead.
export async function isAdmin(): Promise<boolean> {
	return (await currentSession())?.Role === "admin";
}
