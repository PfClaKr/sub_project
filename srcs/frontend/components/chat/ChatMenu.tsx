'use client';

import { useEffect, useRef, useState } from "react";
import { Ban, Flag, MoreVertical, UserCheck } from "lucide-react";
import { ReportDialog } from "@/components/community/ReportButton";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { MenuPanel, MenuToggle, MenuWrap } from "@/styles/styledChat";
import { useTranslations } from "next-intl";

// ChatMenu: report the conversation or block the other member.
export function ChatMenu({ chatId, partner, blockedByMe, onBlock }: {
	chatId: string;
	partner: string;
	blockedByMe: boolean;
	onBlock: (block: boolean) => Promise<void>;
}) {
	const t = useTranslations("chat");
	const confirm = useConfirm();
	const [open, setOpen] = useState(false);
	const [reporting, setReporting] = useState(false);
	const [reported, setReported] = useState(false);
	const wrap = useRef<HTMLDivElement | null>(null);

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

	const toggleBlock = async () => {
		setOpen(false);
		if (!blockedByMe) {
			const ok = await confirm({
				title: t("blockTitle", { name: partner }),
				message: t("blockBody"),
				confirmLabel: t("block"),
				danger: true,
			});
			if (!ok) return;
		}
		await onBlock(!blockedByMe);
	};

	return (
		<MenuWrap ref={wrap}>
			<MenuToggle type="button" aria-label={t("menu")} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
				<MoreVertical size={18} aria-hidden />
			</MenuToggle>
			{open && (
				<MenuPanel role="menu">
					<button type="button" role="menuitem" disabled={reported} onClick={() => { setOpen(false); setReporting(true); }}>
						<Flag size={16} aria-hidden /> {reported ? t("reported") : t("report")}
					</button>
					<button type="button" role="menuitem" className={blockedByMe ? "" : "danger"} onClick={toggleBlock}>
						{blockedByMe ? <><UserCheck size={16} aria-hidden /> {t("unblock")}</> : <><Ban size={16} aria-hidden /> {t("blockAction")}</>}
					</button>
				</MenuPanel>
			)}
			{reporting && <ReportDialog target={{ type: "chat", id: chatId }} onClose={ok => { setReporting(false); if (ok) setReported(true); }} />}
		</MenuWrap>
	);
}
