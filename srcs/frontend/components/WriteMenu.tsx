'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BedDouble, Briefcase, ChevronDown, MessagesSquare, ShoppingBag, SquarePen } from "lucide-react";
import { IconLink, WriteButton, WriteItem, WritePanel, WriteWrap } from "@/styles/styledNav";

// What can be posted, in the order of the sections (labels: write.<key>
// and write.<key>Hint).
const TARGETS = [
	{ href: "/sell", key: "sell", icon: ShoppingBag },
	{ href: "/housing/write", key: "housing", icon: BedDouble },
	{ href: "/jobs/write", key: "job", icon: Briefcase },
	{ href: "/community/write", key: "community", icon: MessagesSquare },
] as const;

// WriteMenu: the header's way into every write page. A labelled button on
// desktop, the pencil icon on phones; both open the same list.
export function WriteMenu({ compact }: { compact?: boolean }) {
	const t = useTranslations("write");
	const [open, setOpen] = useState(false);
	const wrap = useRef<HTMLDivElement | null>(null);
	const pathname = usePathname();
	const writing = TARGETS.some(t => pathname === t.href);

	useEffect(() => setOpen(false), [pathname]);

	useEffect(() => {
		if (!open) return;
		const close = (e: MouseEvent | KeyboardEvent) => {
			if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrap.current?.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", close);
		document.addEventListener("keydown", close);
		return () => {
			document.removeEventListener("mousedown", close);
			document.removeEventListener("keydown", close);
		};
	}, [open]);

	const toggleProps = {
		"aria-haspopup": "menu" as const,
		"aria-expanded": open,
		onClick: () => setOpen(o => !o),
	};

	return (
		<WriteWrap ref={wrap}>
			{compact ? (
				<IconLink as="button" type="button" aria-label={t("button")} aria-current={writing ? "page" : undefined} {...toggleProps}>
					<SquarePen size={20} aria-hidden />
				</IconLink>
			) : (
				<WriteButton type="button" {...toggleProps}>
					<SquarePen size={16} aria-hidden /> {t("button")} <ChevronDown size={14} aria-hidden />
				</WriteButton>
			)}
			{open && (
				<WritePanel role="menu" aria-label={t("menuLabel")}>
					{TARGETS.map(({ href, key, icon: Icon }) => (
						<WriteItem key={href} as={Link} href={href} role="menuitem" onClick={() => setOpen(false)}>
							<span className="icon"><Icon size={18} aria-hidden /></span>
							<span>
								<strong>{t(key)}</strong>
								<small>{t(`${key}Hint`)}</small>
							</span>
						</WriteItem>
					))}
				</WritePanel>
			)}
		</WriteWrap>
	);
}
