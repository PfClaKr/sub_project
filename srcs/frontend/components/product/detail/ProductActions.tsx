'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/libs/session";
import { gql } from "@/libs/graphql";
import { Actions, ReserveActionSpace, StickyActions } from "@/styles/styledDetail";
import { formatPrice } from "@/libs/format";
import { DangerButton, ErrorText, LinkButton, Skeleton, StatusBadge } from "@/styles/styledUi";
import { ChatButton } from "@/components/button/ChatButton";
import { FavoriteButton } from "@/components/button/FavoriteButton";
import { StatusSelector } from "./StatusSelector";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useLocale, useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
import type { Locale } from "@/i18n/config";

// Owners manage the listing; everyone else can save it or start a chat.
export function ProductActions({ productId, ownerId, status, price }: {
	productId: string;
	ownerId?: string;
	status: string;
	price?: number;
}) {
	const t = useTranslations("product");
	const L = useLabels();
	const locale = useLocale() as Locale;
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
				title: t("deleteTitle"),
				message: t("deleteBody"),
				confirmLabel: t("delete"),
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
				setError(error ?? t("deleteError"));
				return;
			}
			router.push("/myaccount");
			router.refresh();
		};

		return (
			<>
				<StatusSelector productId={productId} initial={currentStatus} onChange={setCurrentStatus} />
				<Actions>
					<LinkButton href={`/product/${productId}/edit`} $ghost>{t("edit")}</LinkButton>
					<DangerButton onClick={handleDelete} disabled={deleting}>
						{deleting ? t("deleting") : t("delete")}
					</DangerButton>
				</Actions>
				{error && <ErrorText>{error}</ErrorText>}
			</>
		);
	}

	return (
		<>
			{currentStatus !== "판매중" && (
				<div><StatusBadge $status={currentStatus}>{L.enum("status", currentStatus)}</StatusBadge></div>
			)}
			<StickyActions>
				{price !== undefined && <span className="price">{formatPrice(price, locale)}</span>}
				<FavoriteButton productId={productId} />
				<ChatButton productId={productId} disabled={currentStatus === "판매완료"} disabledLabel={L.enum("status", "판매완료")} />
			</StickyActions>
			<ReserveActionSpace />
		</>
	);
}
