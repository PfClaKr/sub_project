'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BottomBar, BottomSpacer, BottomTab } from "@/styles/styledNav";
import { HOME, SECTIONS, isActive } from "@/libs/sections";

// Phone-only tab bar: home plus the four sections.
export default function BottomTabs() {
	const pathname = usePathname();
	return (
		<>
			<BottomSpacer />
			<BottomBar aria-label="섹션">
				{[HOME, ...SECTIONS].map(s => {
					const active = isActive(s, pathname);
					const Icon = s.icon;
					return (
						<BottomTab key={s.href} as={Link} href={s.href} $active={active} aria-current={active ? "page" : undefined}>
							<Icon size={22} strokeWidth={active ? 2.4 : 1.8} aria-hidden />
							{s.label}
						</BottomTab>
					);
				})}
			</BottomBar>
		</>
	);
}
