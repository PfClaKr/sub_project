'use client';

import { useSession } from "@/libs/session";
import { formatDate } from "@/libs/format";
import { SuspendedBar } from "@/styles/styledNotification";

// Tells a suspended member why posting, chatting and uploading fail.
export function SuspendedBanner() {
	const { session } = useSession();
	if (!session?.Suspended) return null;
	const until = session.SuspendedUntil ? `${formatDate(session.SuspendedUntil)}까지 ` : "";
	return (
		<SuspendedBar role="status">
			운영 정책 위반으로 {until}글쓰기, 채팅, 사진 올리기가 제한된 계정이에요.
		</SuspendedBar>
	);
}
