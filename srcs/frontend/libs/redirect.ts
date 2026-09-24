// safeNext accepts only same-site paths as a post-login redirect.
// "//host" and "/\host" are protocol-relative URLs to another site in
// browsers, so they are rejected like absolute URLs.
export function safeNext(next?: string | null): string {
	if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
	return next;
}
