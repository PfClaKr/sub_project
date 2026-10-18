'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SideNav } from "@/styles/styledAdmin";
import { useTranslations } from "next-intl";

// Labels: admin.nav.<key>.
const LINKS = [
	{ href: "/admin", key: "overview" },
	{ href: "/admin/reports", key: "reports" },
	{ href: "/admin/posts", key: "posts" },
	{ href: "/admin/users", key: "users" },
	{ href: "/admin/products", key: "products" },
	{ href: "/admin/conversations", key: "conversations" },
	{ href: "/admin/site", key: "site" },
] as const;

export function AdminNav() {
	const t = useTranslations("admin");
	const pathname = usePathname();
	return (
		<SideNav aria-label={t("menu")}>
			{LINKS.map(l => {
				const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
				return (
					<Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
						{t(`nav.${l.key}`)}
					</Link>
				);
			})}
		</SideNav>
	);
}
