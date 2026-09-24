'use client';

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { SellerBox } from "@/styles/styledDetail";
import type { User } from "@/libs/types";

export function SellerCard({ user }: { user: User }) {
	return (
		<Link href={`/user/${user.UserId}`} style={{ textDecoration: "none" }}>
			<SellerBox>
				<Avatar src={user.ProfileImage} name={user.UserNickname} size={44} />
				<div>
					<strong>{user.UserNickname ?? "알 수 없는 사용자"}</strong>
					<span>판매 상품 {user.PublishedQuantity ?? 0}개 · 프로필 보기 ›</span>
				</div>
			</SellerBox>
		</Link>
	);
}
