'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
	const t = useTranslations("nav");
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
		<Nav aria-label={t("mainMenu")}>
			<NavInner>
				<Brand>
					<StyledLink href="/">{t("brand")}</StyledLink>
				</Brand>
				<SectionTabs>
					{SECTIONS.map(s => (
						<li key={s.href}>
							<StyledNavbar
								href={s.href}
								$active={isActive(s, pathname)}
								aria-current={isActive(s, pathname) ? "page" : undefined}
							>
								{t(s.key)}
							</StyledNavbar>
						</li>
					))}
				</SectionTabs>
				{session?.Role === "admin" && (
					<DesktopOnly>
						<StyledNavbar href="/admin" $active={pathname.startsWith("/admin")}>{t("admin")}</StyledNavbar>
					</DesktopOnly>
				)}
				<NavSpacer />
				{!loading && (session ? (
					<NavUser>
						<DesktopOnly>
							<WriteMenu />
							<IconLink as={Link} href="/wishlist" aria-label={t("wishlist")} aria-current={current("/wishlist")}>
								<Heart size={20} />
							</IconLink>
						</DesktopOnly>
						<MobileOnly>
							<WriteMenu compact />
						</MobileOnly>
						<IconLink as={Link} href="/chat" aria-label={t("chat")} aria-current={current("/chat")}>
							<MessageCircle size={20} />
						</IconLink>
						<IconLink
							as={Link}
							href="/notifications"
							aria-label={badge ? t("notificationsCount", { count: badge }) : t("notifications")}
							aria-current={current("/notifications")}
						>
							<Bell size={20} />
							{badge && <Badge aria-hidden>{badge}</Badge>}
						</IconLink>
						<StyledNavbar href="/myaccount" $active={pathname === "/myaccount"} aria-label={t("myAccount")}>
							<Avatar src={session.ProfileImage} name={session.UserNickname} size={30} />
						</StyledNavbar>
						<DesktopOnly>
							<GhostButton onClick={handleLogout}>{t("logout")}</GhostButton>
						</DesktopOnly>
					</NavUser>
				) : (
					<LinkButton href="/login">{t("login")}</LinkButton>
				))}
			</NavInner>
		</Nav>
	);
}
