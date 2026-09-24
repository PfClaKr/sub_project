import { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { currentSession } from "@/libs/adminApi";
import { AdminShell } from "@/styles/styledAdmin";
import { PageHeader } from "@/styles/styledLayout";
import { EmptyState, LinkButton } from "@/styles/styledUi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: { template: "%s | 잇냥 관리자", default: "관리자" },
	robots: { index: false },
};

// The layout only decides what to render; the admin API checks the role
// again on every request.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const session = await currentSession();
	if (!session) redirect("/login?next=/admin");

	if (session.Role !== "admin") {
		return (
			<EmptyState>
				<p><strong>403</strong> · 관리자만 볼 수 있는 페이지예요.</p>
				<LinkButton href="/">홈으로</LinkButton>
			</EmptyState>
		);
	}

	return (
		<div>
			<PageHeader>
				<h1>관리자</h1>
				<p>{session.UserNickname}님으로 로그인했어요.</p>
			</PageHeader>
			<AdminShell>
				<AdminNav />
				<div>{children}</div>
			</AdminShell>
		</div>
	);
}
