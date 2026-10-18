'use client';

import Link from "next/link";
import { FooterBar, FooterLegal, FooterLinks } from "@/styles/styledLayout";
import { SECTIONS } from "@/libs/sections";

export default function Footer() {
	return (
		<FooterBar>
			<FooterLinks aria-label="사이트 메뉴">
				{SECTIONS.map(s => <Link key={s.href} href={s.href}>{s.label}</Link>)}
				<Link href="/sell">판매하기</Link>
				<Link href="/safety">안전 가이드</Link>
			</FooterLinks>
			<FooterLegal aria-label="약관과 정책">
				<Link href="/terms">이용약관</Link>
				<Link href="/privacy"><strong>개인정보처리방침</strong></Link>
				<Link href="/legal">운영자 정보 · Mentions légales</Link>
			</FooterLegal>
			<p><strong>잇냥</strong> · 프랑스 한인 생활 커뮤니티</p>
			<p>거래는 직접 만나서, 안전한 공공장소에서 해주세요. 물건이나 집을 보기 전에는 돈을 보내지 마세요.</p>
		</FooterBar>
	);
}
