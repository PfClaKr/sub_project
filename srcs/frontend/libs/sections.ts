import { Briefcase, BedDouble, Home, MessagesSquare, ShoppingBag, type LucideIcon } from "lucide-react";

// Top-level sections, shown as header tabs on desktop and as the bottom
// tab bar on phones. match lists the path prefixes that belong to it.
// key: the label in messages (nav.<key>).
export type Section = { href: string; key: "home" | "market" | "community" | "housing" | "jobs"; icon: LucideIcon; match: string[] };

export const SECTIONS: Section[] = [
	{ href: "/search", key: "market", icon: ShoppingBag, match: ["/search", "/product", "/sell"] },
	{ href: "/community", key: "community", icon: MessagesSquare, match: ["/community"] },
	{ href: "/housing", key: "housing", icon: BedDouble, match: ["/housing"] },
	{ href: "/jobs", key: "jobs", icon: Briefcase, match: ["/jobs"] },
];

export const HOME: Section = { href: "/", key: "home", icon: Home, match: [] };

export function isActive(section: Section, pathname: string): boolean {
	if (section.href === "/") return pathname === "/";
	return section.match.some(prefix => pathname === prefix || pathname.startsWith(prefix + "/"));
}
