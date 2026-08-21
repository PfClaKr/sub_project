'use client';

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { StyledNavbar } from "@/styles/styledLink";
import { Nav, NavInner, Brand, NavItem, NavSpacer, NavUser, SellCta } from "@/styles/styledNav";
import { LOGIN_URL } from "@/libs/config";

type Session = {
	UserId: string;
	UserNickname?: string;
	ProfileImage?: string;
} | null;

export default function Navigation() {
	const [session, setSession] = useState<Session>(null);
	const pathname = usePathname();
	const router = useRouter();

	// Refetch on route change so the navbar updates right after login.
	useEffect(() => {
		fetch(`${LOGIN_URL}/whoami`, { credentials: 'include' })
			.then(res => res.ok ? res.json() : null)
			.then(setSession)
			.catch(() => setSession(null));
	}, [pathname]);

	const handleLogout = async () => {
		try {
			await fetch(`${LOGIN_URL}/logout`, { method: 'POST', credentials: 'include' });
		} finally {
			setSession(null);
			router.push('/');
			router.refresh();
		}
	};

	return (
		<Nav>
			<NavInner>
				<Brand>
					<StyledNavbar href="/">itnyang</StyledNavbar>
				</Brand>
				<NavItem>
					<StyledNavbar href="/search">상품찾기</StyledNavbar>
				</NavItem>
				{session && (
					<>
						<NavItem>
							<StyledNavbar href="/chat">채팅</StyledNavbar>
						</NavItem>
						<NavItem>
							<StyledNavbar href="/wishlist">찜목록</StyledNavbar>
						</NavItem>
					</>
				)}
				<NavSpacer />
				{session ? (
					<>
						<NavUser>
							<StyledNavbar href="/myaccount">{session.UserNickname ?? session.UserId}님</StyledNavbar>
						</NavUser>
						<SellCta>
							<StyledNavbar href="/sell">판매하기</StyledNavbar>
						</SellCta>
						<NavItem>
							<button onClick={handleLogout}>로그아웃</button>
						</NavItem>
					</>
				) : (
					<>
						<NavItem>
							<StyledNavbar href="/login">로그인</StyledNavbar>
						</NavItem>
						<SellCta>
							<StyledNavbar href="/account/sign-up">회원가입</StyledNavbar>
						</SellCta>
					</>
				)}
			</NavInner>
		</Nav>
	);
}
