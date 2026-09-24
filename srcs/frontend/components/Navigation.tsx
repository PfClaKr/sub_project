'use client';

import { usePathname } from "next/navigation";
import { StyledLink, StyledNavbar } from "@/styles/styledLink";
import { Nav, NavInner, Brand, NavLinks, NavSpacer, NavUser } from "@/styles/styledNav";
import { GhostButton, LinkButton } from "@/styles/styledUi";
import { Avatar } from "@/components/ui/Avatar";
import { useSession } from "@/libs/session";

const LINKS = [
	{ href: "/search", label: "상품찾기", auth: false },
	{ href: "/sell", label: "판매하기", auth: true },
	{ href: "/chat", label: "채팅", auth: true },
	{ href: "/wishlist", label: "찜목록", auth: true },
];

export default function Navigation() {
	const { session, loading, logout } = useSession();
	const pathname = usePathname();

	// A full reload drops the client router cache, so no page rendered
	// for the logged-in user (e.g. /admin) can be shown from cache.
	const handleLogout = async () => {
		await logout();
		window.location.assign("/");
	};

	return (
		<Nav aria-label="주 메뉴">
			<NavInner>
				<Brand>
					<StyledLink href="/">잇냥</StyledLink>
				</Brand>
				<NavLinks>
					{LINKS.filter(l => !l.auth || session).map(l => (
						<li key={l.href}>
							<StyledNavbar
								href={l.href}
								$active={pathname.startsWith(l.href)}
								aria-current={pathname.startsWith(l.href) ? "page" : undefined}
							>
								{l.label}
							</StyledNavbar>
						</li>
					))}
				</NavLinks>
				{session?.Role === "admin" && (
					<StyledNavbar href="/admin" $active={pathname.startsWith("/admin")}>관리자</StyledNavbar>
				)}
				<NavSpacer />
				{!loading && (session ? (
					<NavUser>
						<StyledNavbar href="/myaccount" $active={pathname === "/myaccount"}>
							<span style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<Avatar src={session.ProfileImage} name={session.UserNickname} size={28} />
								{session.UserNickname || "내 계정"}
							</span>
						</StyledNavbar>
						<GhostButton onClick={handleLogout}>로그아웃</GhostButton>
					</NavUser>
				) : (
					<LinkButton href="/login">로그인</LinkButton>
				))}
			</NavInner>
		</Nav>
	);
}
