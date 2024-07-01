import Link from "next/link";

export default function Navigation() {
	return (
		<nav>
			<ul>
				<li>
					<div>itnyang</div>
				</li>
				<li>
					<Link href="/">메인홈페이지</Link>
				</li>
				<li>
					<Link href="/search">상품페이지</Link>
				</li>
				<li>
					<Link href="/login">로그인</Link>
				</li>
				<li>
					<Link href="/myaccount">로그인후페이지</Link>
				</li>
				<li>
					<Link href="/wishlist">찜목록페이지</Link>
				</li>
			</ul>
		</nav>
	);
}
