'use client';

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Bike, Shirt, Smartphone, Sofa, Soup, type LucideIcon } from "lucide-react";
import { SearchInput } from "@/components/SearchInput";
import { CatMascot } from "./CatMascot";
import { Paw } from "./Paw";
import {
	Blob, Eyebrow, FloatingItem, Headline, HeroSection, HeroText, Layer, Lead,
	PawPrint, PawTrail, PriceTag, QuickLinks, RotatingWord, Stage,
} from "@/styles/styledLanding";
import palette from "@/theme/colorPalette";

const WORDS = ["사고", "팔고", "나누고"];
const QUICK = ["전기밥솥", "이케아", "아이폰", "한국 책", "자전거"];

// Listings floating around the mascot. SVG icons rather than emoji so
// they look the same on every device.
const ITEMS: { Icon: LucideIcon; color: string; top: string; left: string; delay: number; rot: number; depth: number; size?: number; price?: string }[] = [
	{ Icon: Smartphone, color: palette.primary, top: "6%", left: "8%", delay: 0, rot: -6, depth: 18, price: "€390" },
	{ Icon: Sofa, color: palette.pink, top: "4%", left: "70%", delay: 1.2, rot: 5, depth: 26, size: 72 },
	{ Icon: Soup, color: palette.furDark, top: "44%", left: "-2%", delay: 0.6, rot: 8, depth: 30, price: "€45" },
	{ Icon: Shirt, color: palette.accent, top: "52%", left: "80%", delay: 1.8, rot: -8, depth: 22 },
	{ Icon: BookOpen, color: palette.heading, top: "78%", left: "14%", delay: 2.4, rot: 6, depth: 14, size: 56 },
	{ Icon: Bike, color: palette.primary, top: "80%", left: "66%", delay: 0.9, rot: -4, depth: 20, size: 56, price: "€120" },
];

export function LandingHero() {
	const [word, setWord] = useState(0);
	const stage = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const id = setInterval(() => setWord(w => (w + 1) % WORDS.length), 2200);
		return () => clearInterval(id);
	}, []);

	// Pointer parallax on devices with a fine pointer only (not touch).
	useEffect(() => {
		const el = stage.current;
		if (!el || !window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
		let frame = 0;
		const onMove = (e: PointerEvent) => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				el.style.setProperty("--mx", String((e.clientX / window.innerWidth) * 2 - 1));
				el.style.setProperty("--my", String((e.clientY / window.innerHeight) * 2 - 1));
			});
		};
		window.addEventListener("pointermove", onMove);
		return () => {
			window.removeEventListener("pointermove", onMove);
			cancelAnimationFrame(frame);
		};
	}, []);

	return (
		<HeroSection>
			<Blob $color={palette.sky} $size={320} $top="-120px" $left="-80px" />
			<Blob $color={palette.pink} $size={280} $top="55%" $left="70%" $delay={-6} />

			<HeroText>
				<Eyebrow><Paw /> 파리 한인 중고마켓</Eyebrow>
				<Headline>
					파리 한인끼리<br />
					<RotatingWord key={word}>{WORDS[word]}</RotatingWord> 싶냥?
				</Headline>
				<Lead>안 쓰는 물건은 이웃에게, 필요한 물건은 가까운 곳에서. 채팅으로 약속하고 동네에서 직거래해요.</Lead>
				<SearchInput />
				<QuickLinks>
					<span>인기 검색</span>
					{QUICK.map(q => <Link key={q} href={`/search/${encodeURIComponent(q)}`}>{q}</Link>)}
				</QuickLinks>
			</HeroText>

			<Stage ref={stage} aria-hidden="true">
				{ITEMS.map(it => (
					<Layer key={it.top + it.left} $depth={it.depth}>
						<FloatingItem $top={it.top} $left={it.left} $delay={it.delay} $rot={it.rot} $size={it.size}>
							<it.Icon color={it.color} strokeWidth={1.8} />
							{it.price && <PriceTag>{it.price}</PriceTag>}
						</FloatingItem>
					</Layer>
				))}
				<Layer $depth={-8}>
					<div style={{ position: "absolute", inset: "14% 18% 0" }}>
						<CatMascot />
					</div>
				</Layer>
			</Stage>

			<PawTrail aria-hidden="true">
				{Array.from({ length: 9 }, (_, i) => (
					<PawPrint key={i} $i={i} $count={9}><Paw /></PawPrint>
				))}
			</PawTrail>
		</HeroSection>
	);
}
