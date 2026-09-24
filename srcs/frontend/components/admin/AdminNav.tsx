'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SideNav } from "@/styles/styledAdmin";

const LINKS = [
	{ href: "/admin", label: "개요" },
	{ href: "/admin/users", label: "회원" },
	{ href: "/admin/products", label: "상품" },
	{ href: "/admin/conversations", label: "채팅" },
];

export function AdminNav() {
	const pathname = usePathname();
	return (
		<SideNav aria-label="관리자 메뉴">
			{LINKS.map(l => {
				const active = l.href === "/admin" ? pathname === "/admin" : pathname.startsWith(l.href);
				return (
					<Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
						{l.label}
					</Link>
				);
			})}
		</SideNav>
	);
}
