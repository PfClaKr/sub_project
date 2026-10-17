import { Briefcase, BedDouble, Home, MessagesSquare, ShoppingBag, type LucideIcon } from "lucide-react";

// Top-level sections, shown as header tabs on desktop and as the bottom
// tab bar on phones. match lists the path prefixes that belong to it.
export type Section = { href: string; label: string; icon: LucideIcon; match: string[] };

export const SECTIONS: Section[] = [
	{ href: "/search", label: "중고", icon: ShoppingBag, match: ["/search", "/product", "/sell"] },
	{ href: "/community", label: "커뮤니티", icon: MessagesSquare, match: ["/community"] },
	{ href: "/housing", label: "집", icon: BedDouble, match: ["/housing"] },
	{ href: "/jobs", label: "알바", icon: Briefcase, match: ["/jobs"] },
];

export const HOME: Section = { href: "/", label: "홈", icon: Home, match: [] };

export function isActive(section: Section, pathname: string): boolean {
	if (section.href === "/") return pathname === "/";
	return section.match.some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
}
