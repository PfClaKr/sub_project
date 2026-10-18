'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Heart, MessageCircle } from "lucide-react";
import { StyledLink, StyledNavbar } from "@/styles/styledLink";
import { Nav, NavInner, Brand, SectionTabs, NavSpacer, NavUser, IconLink, Badge, DesktopOnly, MobileOnly } from "@/styles/styledNav";
import { GhostButton, LinkButton } from "@/styles/styledUi";
import { Avatar } from "@/components/ui/Avatar";
import { WriteMenu } from "@/components/WriteMenu";
import { SECTIONS, isActive } from "@/libs/sections";
import { useSession } from "@/libs/session";
import { useNotifications } from "@/libs/notifications";
import { badgeText } from "@/libs/notificationText";

export default function Navigation() {
	const { session, loading, logout } = useSession();
	const { unread } = useNotifications();
	const pathname = usePathname();

	// A full reload drops the client router cache, so no page rendered
	// for the logged-in user (e.g. /admin) can be shown from cache.
	const handleLogout = async () => {
		await logout();
		window.location.assign("/");
	};

	const current = (href: string) => (pathname.startsWith(href) ? "page" : undefined);
	const badge = badgeText(unread);

	return (
		<Nav aria-label="주 메뉴">
			<NavInner>
				<Brand>
					<StyledLink href="/">잇냥</StyledLink>
				</Brand>
				<SectionTabs>
					{SECTIONS.map(s => (
						<li key={s.href}>
							<StyledNavbar
								href={s.href}
								$active={isActive(s, pathname)}
								aria-current={isActive(s, pathname) ? "page" : undefined}
							>
								{s.label}
							</StyledNavbar>
						</li>
					))}
				</SectionTabs>
				{session?.Role === "admin" && (
					<DesktopOnly>
						<StyledNavbar href="/admin" $active={pathname.startsWith("/admin")}>관리자</StyledNavbar>
					</DesktopOnly>
				)}
				<NavSpacer />
				{!loading && (session ? (
					<NavUser>
						<DesktopOnly>
							<WriteMenu />
							<IconLink as={Link} href="/wishlist" aria-label="찜 목록" aria-current={current("/wishlist")}>
								<Heart size={20} />
							</IconLink>
						</DesktopOnly>
						<MobileOnly>
							<WriteMenu compact />
						</MobileOnly>
						<IconLink as={Link} href="/chat" aria-label="채팅" aria-current={current("/chat")}>
							<MessageCircle size={20} />
						</IconLink>
						<IconLink
							as={Link}
							href="/notifications"
							aria-label={badge ? `알림 ${badge}개` : "알림"}
							aria-current={current("/notifications")}
						>
							<Bell size={20} />
							{badge && <Badge aria-hidden>{badge}</Badge>}
						</IconLink>
						<StyledNavbar href="/myaccount" $active={pathname === "/myaccount"} aria-label="내 계정">
							<Avatar src={session.ProfileImage} name={session.UserNickname} size={30} />
						</StyledNavbar>
						<DesktopOnly>
							<GhostButton onClick={handleLogout}>로그아웃</GhostButton>
						</DesktopOnly>
					</NavUser>
				) : (
					<LinkButton href="/login">로그인</LinkButton>
				))}
			</NavInner>
		</Nav>
	);
}
