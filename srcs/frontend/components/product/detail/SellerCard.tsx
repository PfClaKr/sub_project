'use client';

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { SellerBox } from "@/styles/styledDetail";
import type { User } from "@/libs/types";
import { useLocale, useTranslations } from "next-intl";

export function SellerCard({ user }: { user: User }) {
	const t = useTranslations("product");
	return (
		<Link href={`/user/${user.UserId}`} style={{ textDecoration: "none" }}>
			<SellerBox>
				<Avatar src={user.ProfileImage} name={user.UserNickname} size={44} />
				<div>
					<strong>{user.UserNickname ?? t("unknownSeller")}</strong>
					<span>{t("sellerStats", { count: user.PublishedQuantity ?? 0 })}</span>
				</div>
			</SellerBox>
		</Link>
	);
}
