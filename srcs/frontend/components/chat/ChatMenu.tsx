'use client';

import { useEffect, useRef, useState } from "react";
import { Ban, Flag, MoreVertical, UserCheck } from "lucide-react";
import { ReportDialog } from "@/components/community/ReportButton";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { MenuPanel, MenuToggle, MenuWrap } from "@/styles/styledChat";

// ChatMenu: report the conversation or block the other member.
export function ChatMenu({ chatId, partner, blockedByMe, onBlock }: {
	chatId: string;
	partner: string;
	blockedByMe: boolean;
	onBlock: (block: boolean) => Promise<void>;
}) {
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
				title: `${partner}님을 차단할까요?`,
				message: "서로 메시지를 보낼 수 없고, 새 채팅도 시작할 수 없어요. 상대에게는 차단했다는 사실이 알려지지 않아요. 마이페이지에서 언제든 해제할 수 있어요.",
				confirmLabel: "차단",
				danger: true,
			});
			if (!ok) return;
		}
		await onBlock(!blockedByMe);
	};

	return (
		<MenuWrap ref={wrap}>
			<MenuToggle type="button" aria-label="채팅 메뉴" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
				<MoreVertical size={18} aria-hidden />
			</MenuToggle>
			{open && (
				<MenuPanel role="menu">
					<button type="button" role="menuitem" disabled={reported} onClick={() => { setOpen(false); setReporting(true); }}>
						<Flag size={16} aria-hidden /> {reported ? "신고했어요" : "신고하기"}
					</button>
					<button type="button" role="menuitem" className={blockedByMe ? "" : "danger"} onClick={toggleBlock}>
						{blockedByMe ? <><UserCheck size={16} aria-hidden /> 차단 해제</> : <><Ban size={16} aria-hidden /> 차단하기</>}
					</button>
				</MenuPanel>
			)}
			{reporting && <ReportDialog target={{ type: "chat", id: chatId }} onClose={ok => { setReporting(false); if (ok) setReported(true); }} />}
		</MenuWrap>
	);
}
