'use client';

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "@/libs/session";
import { EmptyState, LinkButton, Skeleton } from "@/styles/styledUi";
import type { Session } from "@/libs/types";

// RequireLogin renders children only for logged-in users and offers a
// login link (returning here afterwards) otherwise.
export function RequireLogin({ children }: { children: (session: Session) => React.ReactNode }) {
	const t = useTranslations("auth.required");
	const { session, loading } = useSession();
	const pathname = usePathname();

	if (loading) return <Skeleton $h="120px" />;
	if (!session) {
		return (
			<EmptyState>
				<p>{t("title")}</p>
				<LinkButton href={`/login?next=${encodeURIComponent(pathname)}`}>{t("login")}</LinkButton>
			</EmptyState>
		);
	}
	return <>{children(session)}</>;
}
