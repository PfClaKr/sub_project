'use client';

import { usePathname } from "next/navigation";
import { useSession } from "@/libs/session";
import { EmptyState, LinkButton, Skeleton } from "@/styles/styledUi";
import type { Session } from "@/libs/types";

// RequireLogin renders children only for logged-in users and offers a
// login link (returning here afterwards) otherwise.
export function RequireLogin({ children }: { children: (session: Session) => React.ReactNode }) {
	const { session, loading } = useSession();
	const pathname = usePathname();

	if (loading) return <Skeleton $h="120px" />;
	if (!session) {
		return (
			<EmptyState>
				<p>로그인이 필요한 페이지예요.</p>
				<LinkButton href={`/login?next=${encodeURIComponent(pathname)}`}>로그인하기</LinkButton>
			</EmptyState>
		);
	}
	return <>{children(session)}</>;
}
