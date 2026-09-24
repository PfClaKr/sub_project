'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { GhostButton } from "@/styles/styledUi";
import { Backdrop, DangerSolid, Dialog, DialogActions, DialogField, DialogIcon } from "@/styles/styledModal";

export type ConfirmOptions = {
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
	// When set, the confirm button stays disabled until this exact text
	// (case-insensitive) is typed, e.g. the email of an account to delete.
	requireText?: string;
	requireLabel?: string;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

// ConfirmProvider replaces window.confirm/prompt with an in-app dialog:
// `if (await confirm({ title: "삭제할까요?", danger: true })) ...`
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
	const [pending, setPending] = useState<Pending | null>(null);

	const confirm = useCallback(
		(o: ConfirmOptions) => new Promise<boolean>(resolve => setPending({ ...o, resolve })),
		[],
	);

	const close = (ok: boolean) => {
		pending?.resolve(ok);
		setPending(null);
	};

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			{pending && <ConfirmModal options={pending} onClose={close} />}
		</ConfirmContext.Provider>
	);
}

export function useConfirm() {
	const ctx = useContext(ConfirmContext);
	if (!ctx) throw new Error("useConfirm must be used inside ConfirmProvider");
	return ctx;
}

function ConfirmModal({ options, onClose }: { options: ConfirmOptions; onClose: (ok: boolean) => void }) {
	const [typed, setTyped] = useState("");
	const confirmRef = useRef<HTMLButtonElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const restoreFocus = useRef<Element | null>(null);
	const valid = !options.requireText || typed.trim().toLowerCase() === options.requireText.toLowerCase();

	useEffect(() => {
		restoreFocus.current = document.activeElement;
		(inputRef.current ?? confirmRef.current)?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose(false);
		};
		window.addEventListener("keydown", onKey);
		const overflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = overflow;
			(restoreFocus.current as HTMLElement | null)?.focus?.();
		};
	}, [onClose]);

	const Confirm = options.danger ? DangerSolid : "button";

	return (
		<Backdrop onMouseDown={e => e.target === e.currentTarget && onClose(false)}>
			<Dialog role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
				<DialogIcon $danger={options.danger} aria-hidden>
					{options.danger ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
				</DialogIcon>
				<h2 id="confirm-title">{options.title}</h2>
				{options.message && <p id="confirm-message">{options.message}</p>}
				<form
					onSubmit={e => {
						e.preventDefault();
						if (valid) onClose(true);
					}}
				>
					{options.requireText && (
						<DialogField>
							<span>{options.requireLabel ?? "확인을 위해 입력해주세요"}: <code>{options.requireText}</code></span>
							<input ref={inputRef} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
						</DialogField>
					)}
					<DialogActions>
						<GhostButton type="button" onClick={() => onClose(false)}>{options.cancelLabel ?? "취소"}</GhostButton>
						<Confirm ref={confirmRef} type="submit" disabled={!valid}>{options.confirmLabel ?? "확인"}</Confirm>
					</DialogActions>
				</form>
			</Dialog>
		</Backdrop>
	);
}
