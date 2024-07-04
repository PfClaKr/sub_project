'use client';

import Link from "next/link";
import { StyledNavbar } from "@/styles/styledLink";

export default function Navigation() {
	return (
		<nav>
			<ul>
				<li>
					<div>itnyang</div>
				</li>
				<li>
					<StyledNavbar href="/">메인홈페이지</StyledNavbar>
				</li>
				<li>
					<StyledNavbar href="/search">상품페이지</StyledNavbar>
				</li>
				<li>
					<StyledNavbar href="/login">로그인</StyledNavbar>
				</li>
				<li>
					<StyledNavbar href="/myaccount">로그인후페이지</StyledNavbar>
				</li>
				<li>
					<StyledNavbar href="/wishlist">찜목록페이지</StyledNavbar>
				</li>
			</ul>
		</nav>
	);
}
