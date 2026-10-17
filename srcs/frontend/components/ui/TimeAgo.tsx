import { formatDateTime, formatRelative, toMs } from "@/libs/format";

// "3분 전" with the exact time on hover. The server and the browser can
// render a minute apart, so the text may differ at hydration; the
// warning is suppressed for this element only.
export function TimeAgo({ ts }: { ts?: number }) {
	if (!ts) return null;
	return (
		<time dateTime={new Date(toMs(ts)).toISOString()} title={formatDateTime(ts)} suppressHydrationWarning>
			{formatRelative(ts)}
		</time>
	);
}
