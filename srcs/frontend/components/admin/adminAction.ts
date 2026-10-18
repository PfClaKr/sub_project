import { API_URL } from "@/libs/config";
import { libText } from "@/libs/libText";

// adminAction sends a write to the admin API from the browser and
// returns a user-facing error message, or "" on success.
export async function adminAction(method: "PATCH" | "DELETE" | "POST" | "PUT", path: string, body?: unknown): Promise<string> {
	try {
		const res = await fetch(`${API_URL}/admin${path}`, {
			method,
			credentials: "include",
			headers: body ? { "Content-Type": "application/json" } : undefined,
			body: body ? JSON.stringify(body) : undefined,
		});
		if (res.ok) return "";
		const json = await res.json().catch(() => null);
		return json?.error ?? libText("server");
	} catch {
		return libText("server");
	}
}
