'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DangerButton, ErrorText, GhostButton } from "@/styles/styledUi";
import { STATUSES } from "@/libs/constants";
import { adminAction } from "./adminAction";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useLocale, useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
import { formatDate } from "@/libs/format";
import type { Locale } from "@/i18n/config";

function useAction() {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	// Resolves to whether it worked, so a select can go back to its value.
	const run = async (fn: () => Promise<string>) => {
		setBusy(true);
		setError("");
		const err = await fn();
		setBusy(false);
		if (err) setError(err);
		else router.refresh();
		return !err;
	};
	return { busy, error, run };
}

export function RoleControl({ userId, role }: { userId: string; role: string }) {
	const t = useTranslations("admin.controls");
	const u = useTranslations("admin.users");
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	return (
		<>
			<select
				aria-label={t("role")}
				defaultValue={role}
				disabled={busy}
				onChange={async e => {
					const select = e.target;
					const next = select.value;
					const ok = await confirm(next === "admin"
						? { title: t("makeAdminTitle"), message: t("makeAdminBody"), confirmLabel: t("makeAdmin") }
						: { title: t("removeAdminTitle"), message: t("removeAdminBody"), confirmLabel: t("removeAdmin"), danger: true });
					if (!ok) {
						select.value = role;
						return;
					}
					if (!(await run(() => adminAction("PATCH", `/users/${userId}`, { Role: next })))) select.value = role;
				}}
			>
				<option value="user">{u("member")}</option>
				<option value="admin">{u("admin")}</option>
			</select>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

// Deleting asks for the account's email typed back, as in ineverywhere:
// it removes the member's listings and favourites for good.
export function UserDeleteControl({ userId, email, nickname }: { userId: string; email: string; nickname: string }) {
	const t = useTranslations("admin.controls");
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	return (
		<>
			<DangerButton
				disabled={busy}
				onClick={async () => {
					const ok = await confirm({
						title: t("deleteMemberTitle", { name: nickname }),
						message: t("deleteMemberBody"),
						confirmLabel: t("deleteMember"),
						danger: true,
						requireText: email,
						requireLabel: t("typeEmail"),
					});
					if (ok) run(() => adminAction("DELETE", `/users/${userId}`));
				}}
			>
				{busy ? t("deleting") : t("delete")}
			</DangerButton>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

export function ProductStatusControl({ productId, status }: { productId: string; status: string }) {
	const t = useTranslations("admin.controls");
	const L = useLabels();
	const { busy, error, run } = useAction();
	return (
		<>
			<select
				aria-label={t("productStatus")}
				defaultValue={status}
				disabled={busy}
				onChange={async e => {
					const select = e.target;
					if (!(await run(() => adminAction("PATCH", `/products/${productId}`, { ProductStatus: select.value })))) select.value = status;
				}}
			>
				{STATUSES.map(s => <option key={s} value={s}>{L.enum("status", s)}</option>)}
			</select>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

export function ProductDeleteControl({ productId, name }: { productId: string; name: string }) {
	const t = useTranslations("admin.controls");
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	return (
		<>
			<DangerButton
				disabled={busy}
				onClick={async () => {
					const ok = await confirm({
						title: t("deleteProductTitle"),
						message: t("deleteProductBody", { name }),
						confirmLabel: t("delete"),
						danger: true,
					});
					if (ok) run(() => adminAction("DELETE", `/products/${productId}`));
				}}
			>
				{busy ? t("deleting") : t("delete")}
			</DangerButton>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

// Labels: admin.controls.days<n>.
const SUSPENSIONS = [1, 7, 30, 0];

// SuspensionControl blocks a member's writes for a period, or lifts it.
export function SuspensionControl({ userId, nickname, suspended, until }: {
	userId: string;
	nickname: string;
	suspended: boolean;
	until?: number;
}) {
	const t = useTranslations("admin.controls");
	const locale = useLocale() as Locale;
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	if (suspended) {
		return (
			<>
				<small>{until ? t("suspendedUntil", { date: formatDate(until, locale) }) : t("suspendedForever")}</small>{" "}
				<button
					type="button"
					disabled={busy}
					onClick={async () => {
						if (await confirm({ title: t("liftTitle", { name: nickname }), confirmLabel: t("lift") })) {
							run(() => adminAction("DELETE", `/users/${userId}/suspension`));
						}
					}}
				>
					{t("lift")}
				</button>
				{error && <ErrorText>{error}</ErrorText>}
			</>
		);
	}
	return (
		<>
			<select
				aria-label={t("suspension")}
				defaultValue=""
				disabled={busy}
				onChange={async e => {
					const select = e.target;
					const days = Number(select.value);
					select.value = "";
					const period = t(`days${days}`);
					const ok = await confirm({
						title: t("suspendTitle", { name: nickname, period }),
						message: t("suspendBody"),
						confirmLabel: t("suspend"),
						danger: true,
					});
					if (ok) run(() => adminAction("PUT", `/users/${userId}/suspension`, { Days: days }));
				}}
			>
				<option value="" disabled>{t("suspendPlaceholder")}</option>
				{SUSPENSIONS.map(d => <option key={d} value={d}>{t(`days${d}`)}</option>)}
			</select>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

// tone: the main action of a row is filled, the rest outlined, deleting
// red. Texts: admin.controls.actions.<action>.{label,title,message}.
const REPORT_ACTIONS: Record<string, "primary" | "ghost" | "danger"> = {
	dismiss: "ghost",
	hide: "primary",
	delete: "danger",
	resolve: "primary",
};

// ReportActions closes every open report about a target with one action.
export function ReportActions({ targetType, targetId, actions }: { targetType: string; targetId: string; actions: string[] }) {
	const t = useTranslations("admin.controls");
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	return (
		<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
			{actions.map(a => {
				const tone = REPORT_ACTIONS[a];
				const def = { label: t(`actions.${a}.label`), title: t(`actions.${a}.title`), message: t(`actions.${a}.message`) };
				const Button = { primary: "button" as const, ghost: GhostButton, danger: DangerButton }[tone];
				return (
					<Button
						key={a}
						type="button"
						disabled={busy}
						onClick={async () => {
							if (await confirm({ title: def.title, message: def.message, confirmLabel: def.label, danger: tone === "danger" })) {
								run(() => adminAction("POST", "/reports/resolve", { TargetType: targetType, TargetId: targetId, Action: a }));
							}
						}}
					>
						{def.label}
					</Button>
				);
			})}
			{error && <ErrorText>{error}</ErrorText>}
		</div>
	);
}

// PostStatusControl shows, hides or deletes a community/housing/job post.
export function PostStatusControl({ postId, status }: { postId: string; status: string }) {
	const t = useTranslations("admin.controls");
	const p = useTranslations("admin.posts");
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	return (
		<>
			<select
				aria-label={t("postStatus")}
				defaultValue={status}
				disabled={busy || status === "deleted"}
				onChange={async e => {
					const select = e.target;
					const next = select.value;
					if (next === "deleted" && !(await confirm({ title: t("deletePostTitle"), message: t("deletePostBody"), danger: true, confirmLabel: t("delete") }))) {
						select.value = status;
						return;
					}
					if (!(await run(() => adminAction("PATCH", `/posts/${postId}`, { Status: next })))) select.value = status;
				}}
			>
				<option value="active">{p("active")}</option>
				<option value="hidden">{p("hidden")}</option>
				{status === "expired" && <option value="expired" disabled>{p("expired")}</option>}
				<option value="deleted">{p("deleted")}</option>
			</select>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}
