import { revalidateTag } from "next/cache";
import { adminGet } from "@/libs/adminApi";

// POST after a save on /admin/site: drops the cached site content
// (libs/site.server.ts, tag "site") so the change shows at once. Only
// admins: the admin API refuses everyone else.
export async function POST() {
	try {
		await adminGet("/site");
	} catch {
		return new Response(null, { status: 403 });
	}
	revalidateTag("site");
	return Response.json({ ok: true });
}
