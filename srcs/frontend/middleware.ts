import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_PAGE_HEADER } from "@/libs/site";

// Admin pages always render saved content, even while the site editor's
// preview cookie is set (libs/site.server.ts previewLocale): the editor
// itself must not change language or colours under the admin.
export function middleware(req: NextRequest) {
	const headers = new Headers(req.headers);
	headers.set(ADMIN_PAGE_HEADER, "1");
	return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
