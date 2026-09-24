'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/libs/session";
import { gql } from "@/libs/graphql";
import { Actions } from "@/styles/styledDetail";
import { DangerButton, ErrorText, LinkButton, Skeleton, StatusBadge } from "@/styles/styledUi";
import { ChatButton } from "@/components/button/ChatButton";
import { FavoriteButton } from "@/components/button/FavoriteButton";
import { StatusSelector } from "./StatusSelector";
import { useConfirm } from "@/components/ui/ConfirmDialog";

// Owners manage the listing; everyone else can save it or start a chat.
export function ProductActions({ productId, ownerId, status }: {
	productId: string;
	ownerId?: string;
	status: string;
}) {
	const { session, loading } = useSession();
	const router = useRouter();
	const confirm = useConfirm();
	const [currentStatus, setCurrentStatus] = useState(status);
	const [error, setError] = useState("");
	const [deleting, setDeleting] = useState(false);

	if (loading) return <Skeleton $h="40px" />;

	if (session && session.UserId === ownerId) {
		const handleDelete = async () => {
			const ok = await confirm({
				title: "이 상품을 삭제할까요?",
				message: "삭제한 상품과 사진은 되돌릴 수 없어요.",
				confirmLabel: "삭제",
				danger: true,
			});
			if (!ok) return;
			setDeleting(true);
			const { data, error } = await gql<{ deleteProduct: boolean }>(
				`mutation D($productId: String!) { deleteProduct(ProductId: $productId) }`,
				{ productId },
			);
			setDeleting(false);
			if (!data?.deleteProduct) {
				setError(error ?? "삭제하지 못했어요.");
				return;
			}
			router.push("/myaccount");
			router.refresh();
		};

		return (
			<>
				<StatusSelector productId={productId} initial={currentStatus} onChange={setCurrentStatus} />
				<Actions>
					<LinkButton href={`/product/${productId}/edit`} $ghost>수정하기</LinkButton>
					<DangerButton onClick={handleDelete} disabled={deleting}>
						{deleting ? "삭제 중..." : "삭제하기"}
					</DangerButton>
				</Actions>
				{error && <ErrorText>{error}</ErrorText>}
			</>
		);
	}

	return (
		<>
			{currentStatus !== "판매중" && (
				<div><StatusBadge $status={currentStatus}>{currentStatus}</StatusBadge></div>
			)}
			<Actions>
				<FavoriteButton productId={productId} />
				<ChatButton productId={productId} disabled={currentStatus === "판매완료"} />
			</Actions>
		</>
	);
}
