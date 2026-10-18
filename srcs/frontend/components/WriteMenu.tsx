'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BedDouble, Briefcase, ChevronDown, MessagesSquare, ShoppingBag, SquarePen } from "lucide-react";
import { IconLink, WriteButton, WriteItem, WritePanel, WriteWrap } from "@/styles/styledNav";

// What can be posted, in the order of the sections.
const TARGETS = [
	{ href: "/sell", label: "물건 팔기", hint: "중고 물건을 올려요", icon: ShoppingBag },
	{ href: "/housing/write", label: "방 올리기·구하기", hint: "쉐어, 스튜디오, 서블렛", icon: BedDouble },
	{ href: "/jobs/write", label: "구인·구직", hint: "알바, 과외, 통역", icon: Briefcase },
	{ href: "/community/write", label: "질문·이야기", hint: "생활 Q&A, 자유 게시판", icon: MessagesSquare },
];

// WriteMenu: the header's way into every write page. A labelled button on
// desktop, the pencil icon on phones; both open the same list.
export function WriteMenu({ compact }: { compact?: boolean }) {
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
				<IconLink as="button" type="button" aria-label="글쓰기" aria-current={writing ? "page" : undefined} {...toggleProps}>
					<SquarePen size={20} aria-hidden />
				</IconLink>
			) : (
				<WriteButton type="button" {...toggleProps}>
					<SquarePen size={16} aria-hidden /> 글쓰기 <ChevronDown size={14} aria-hidden />
				</WriteButton>
			)}
			{open && (
				<WritePanel role="menu" aria-label="무엇을 올릴까요?">
					{TARGETS.map(({ href, label, hint, icon: Icon }) => (
						<WriteItem key={href} as={Link} href={href} role="menuitem" onClick={() => setOpen(false)}>
							<span className="icon"><Icon size={18} aria-hidden /></span>
							<span>
								<strong>{label}</strong>
								<small>{hint}</small>
							</span>
						</WriteItem>
					))}
				</WritePanel>
			)}
		</WriteWrap>
	);
}
