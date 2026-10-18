'use client';

import { useEffect, useState, FormEvent } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
import { Flag } from "lucide-react";
import { REPORT_REASONS } from "@/libs/constants";
import { gql } from "@/libs/graphql";
import { useSession } from "@/libs/session";
import { GhostButton, ErrorText } from "@/styles/styledUi";
import { Backdrop, Dialog, DialogActions, DialogField, DialogIcon } from "@/styles/styledModal";
import { ReportOptions, TextButton } from "@/styles/styledCommunity";

export type ReportTarget = { type: "post" | "comment" | "product" | "user" | "chat"; id: string };

// ReportButton opens a small form (reason + optional detail) and files a
// report for the admins. Visitors are sent to log in first.
export function ReportButton({ target, label }: { target: ReportTarget; label?: string }) {
	const t = useTranslations("report");
	const { session } = useSession();
	const pathname = usePathname();
	const [open, setOpen] = useState(false);
	const [done, setDone] = useState(false);

	if (done) return <TextButton disabled>{t("done")}</TextButton>;
	return (
		<>
			<TextButton
				type="button"
				onClick={() => (session ? setOpen(true) : window.location.assign(`/login?next=${encodeURIComponent(pathname)}`))}
			>
				{label ?? t("button")}
			</TextButton>
			{open && <ReportDialog target={target} onClose={ok => { setOpen(false); if (ok) setDone(true); }} />}
		</>
	);
}

export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: (ok: boolean) => void }) {
	const t = useTranslations("report");
	const c = useTranslations("common");
	const L = useLabels();
	const [reason, setReason] = useState("");
	const [detail, setDetail] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose(false);
		window.addEventListener("keydown", onKey);
		const overflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = overflow;
		};
	}, [onClose]);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (!reason) {
			setError(t("chooseReason"));
			return;
		}
		setBusy(true);
		const { error } = await gql(
			`mutation Report($t: String!, $id: String!, $r: String!, $d: String) { report(TargetType: $t, TargetId: $id, Reason: $r, Detail: $d) }`,
			{ t: target.type, id: target.id, r: reason, d: detail.trim() || null },
		);
		setBusy(false);
		if (error) {
			setError(error);
			if (error.startsWith("이미 신고")) setTimeout(() => onClose(true), 1200);
			return;
		}
		onClose(true);
	};

	return (
		<Backdrop onMouseDown={e => e.target === e.currentTarget && onClose(false)}>
			<Dialog role="dialog" aria-modal="true" aria-labelledby="report-title" style={{ maxWidth: 440 }}>
				<DialogIcon $danger aria-hidden><Flag size={20} /></DialogIcon>
				<h2 id="report-title">{t("title")}</h2>
				<p>{t("lead")}</p>
				<form onSubmit={submit}>
					<ReportOptions>
						<legend className="sr-only">{t("reason")}</legend>
						{REPORT_REASONS.map(r => (
							<label key={r}>
								<input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} />
								{L.enum("reportReason", r)}
							</label>
						))}
					</ReportOptions>
					<DialogField>
						<span>{t("detail")}</span>
						<textarea value={detail} onChange={e => setDetail(e.target.value)} maxLength={500} rows={3} placeholder={t("detailPlaceholder")} />
					</DialogField>
					{error && <ErrorText role="alert">{error}</ErrorText>}
					<DialogActions>
						<GhostButton type="button" onClick={() => onClose(false)}>{c("cancel")}</GhostButton>
						<button type="submit" disabled={busy}>{busy ? t("sending") : t("submit")}</button>
					</DialogActions>
				</form>
			</Dialog>
		</Backdrop>
	);
}
