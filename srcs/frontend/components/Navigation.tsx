'use client';

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { StyledNavbar } from "@/styles/styledLink";
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
				{session ? (
					<>
						<li>
							<span>{session.UserNickname ?? session.UserId}님</span>
						</li>
						<li>
							<StyledNavbar href="/sell">판매하기</StyledNavbar>
						</li>
						<li>
							<StyledNavbar href="/myaccount">마이페이지</StyledNavbar>
						</li>
						<li>
							<StyledNavbar href="/wishlist">찜목록페이지</StyledNavbar>
						</li>
						<li>
							<button onClick={handleLogout}>로그아웃</button>
						</li>
					</>
				) : (
					<li>
						<StyledNavbar href="/login">로그인</StyledNavbar>
					</li>
				)}
			</ul>
		</nav>
	);
}
