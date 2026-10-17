'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DangerButton, ErrorText } from "@/styles/styledUi";
import { STATUSES } from "@/libs/constants";
import { adminAction } from "./adminAction";
import { useConfirm } from "@/components/ui/ConfirmDialog";

function useAction() {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const run = async (fn: () => Promise<string>) => {
		setBusy(true);
		setError("");
		const err = await fn();
		setBusy(false);
		if (err) setError(err);
		else router.refresh();
	};
	return { busy, error, run };
}

export function RoleControl({ userId, role }: { userId: string; role: string }) {
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	return (
		<>
			<select
				aria-label="권한"
				defaultValue={role}
				disabled={busy}
				onChange={async e => {
					const select = e.target;
					const next = select.value;
					const ok = await confirm(next === "admin"
						? { title: "관리자로 지정할까요?", message: "관리자는 모든 회원, 상품, 채팅을 보고 관리할 수 있어요.", confirmLabel: "지정" }
						: { title: "관리자 권한을 해제할까요?", message: "이 회원은 바로 관리자 페이지에 들어올 수 없게 돼요.", confirmLabel: "해제", danger: true });
					if (!ok) {
						select.value = role;
						return;
					}
					run(() => adminAction("PATCH", `/users/${userId}`, { Role: next }));
				}}
			>
				<option value="user">회원</option>
				<option value="admin">관리자</option>
			</select>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

// Deleting asks for the account's email typed back, as in ineverywhere:
// it removes the member's listings and favourites for good.
export function UserDeleteControl({ userId, email, nickname }: { userId: string; email: string; nickname: string }) {
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	return (
		<>
			<DangerButton
				disabled={busy}
				onClick={async () => {
					const ok = await confirm({
						title: `${nickname} 회원을 삭제할까요?`,
						message: "등록한 상품과 찜 목록이 모두 삭제되고 되돌릴 수 없어요. 채팅 기록은 분쟁 처리를 위해 남아요.",
						confirmLabel: "회원 삭제",
						danger: true,
						requireText: email,
						requireLabel: "확인을 위해 이메일을 입력해주세요",
					});
					if (ok) run(() => adminAction("DELETE", `/users/${userId}`));
				}}
			>
				{busy ? "삭제 중..." : "삭제"}
			</DangerButton>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

export function ProductStatusControl({ productId, status }: { productId: string; status: string }) {
	const { busy, error, run } = useAction();
	return (
		<>
			<select
				aria-label="판매 상태"
				defaultValue={status}
				disabled={busy}
				onChange={e => run(() => adminAction("PATCH", `/products/${productId}`, { ProductStatus: e.target.value }))}
			>
				{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
			</select>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

export function ProductDeleteControl({ productId, name }: { productId: string; name: string }) {
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	return (
		<>
			<DangerButton
				disabled={busy}
				onClick={async () => {
					const ok = await confirm({
						title: "상품을 삭제할까요?",
						message: `"${name}"\n삭제하면 검색과 판매자 목록에서도 사라지고 되돌릴 수 없어요.`,
						confirmLabel: "삭제",
						danger: true,
					});
					if (ok) run(() => adminAction("DELETE", `/products/${productId}`));
				}}
			>
				{busy ? "삭제 중..." : "삭제"}
			</DangerButton>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

const SUSPENSIONS = [
	{ days: 1, label: "1일" },
	{ days: 7, label: "7일" },
	{ days: 30, label: "30일" },
	{ days: 0, label: "무기한" },
];

// SuspensionControl blocks a member's writes for a period, or lifts it.
export function SuspensionControl({ userId, nickname, suspended, until }: {
	userId: string;
	nickname: string;
	suspended: boolean;
	until?: number;
}) {
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	if (suspended) {
		return (
			<>
				<small>{until ? `${new Date(until).toLocaleDateString("ko-KR")}까지 정지` : "무기한 정지"}</small>{" "}
				<button
					type="button"
					disabled={busy}
					onClick={async () => {
						if (await confirm({ title: `${nickname} 회원의 정지를 풀까요?`, confirmLabel: "해제" })) {
							run(() => adminAction("DELETE", `/users/${userId}/suspension`));
						}
					}}
				>
					해제
				</button>
				{error && <ErrorText>{error}</ErrorText>}
			</>
		);
	}
	return (
		<>
			<select
				aria-label="정지"
				defaultValue=""
				disabled={busy}
				onChange={async e => {
					const select = e.target;
					const days = Number(select.value);
					select.value = "";
					const label = SUSPENSIONS.find(s => s.days === days)?.label;
					const ok = await confirm({
						title: `${nickname} 회원을 ${label} 정지할까요?`,
						message: "정지된 회원은 로그인은 되지만 글·댓글·채팅·사진 올리기를 할 수 없어요.",
						confirmLabel: "정지",
						danger: true,
					});
					if (ok) run(() => adminAction("PUT", `/users/${userId}/suspension`, { Days: days }));
				}}
			>
				<option value="" disabled>정지…</option>
				{SUSPENSIONS.map(s => <option key={s.days} value={s.days}>{s.label}</option>)}
			</select>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

const REPORT_ACTIONS: Record<string, { label: string; title: string; message: string; danger?: boolean }> = {
	dismiss: { label: "문제 없음", title: "신고를 기각할까요?", message: "숨겨진 경우 다시 공개되고, 작성자에게 복구 알림이 가요." },
	hide: { label: "숨기기", title: "숨김 처리할까요?", message: "작성자에게만 보이고, 작성자에게 알림이 가요." },
	delete: { label: "삭제", title: "삭제할까요?", message: "되돌릴 수 없어요.", danger: true },
};

// ReportActions closes every open report about a target with one action.
export function ReportActions({ targetType, targetId, actions }: { targetType: string; targetId: string; actions: string[] }) {
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	return (
		<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
			{actions.map(a => {
				const def = REPORT_ACTIONS[a];
				const Button = def.danger ? DangerButton : "button";
				return (
					<Button
						key={a}
						type="button"
						disabled={busy}
						onClick={async () => {
							if (await confirm({ title: def.title, message: def.message, confirmLabel: def.label, danger: def.danger })) {
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
	const { busy, error, run } = useAction();
	const confirm = useConfirm();
	return (
		<>
			<select
				aria-label="공개 상태"
				defaultValue={status}
				disabled={busy || status === "deleted"}
				onChange={async e => {
					const select = e.target;
					const next = select.value;
					if (next === "deleted" && !(await confirm({ title: "글을 삭제할까요?", message: "되돌릴 수 없어요.", danger: true, confirmLabel: "삭제" }))) {
						select.value = status;
						return;
					}
					run(() => adminAction("PATCH", `/posts/${postId}`, { Status: next }));
				}}
			>
				<option value="active">공개</option>
				<option value="hidden">숨김</option>
				{status === "expired" && <option value="expired" disabled>만료</option>}
				<option value="deleted">삭제</option>
			</select>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}
