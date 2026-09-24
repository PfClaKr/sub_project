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
