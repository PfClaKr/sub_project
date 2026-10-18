'use client';

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BedDouble, Briefcase, MessageCircleQuestion, ShoppingBag, Sofa, Soup, type LucideIcon } from "lucide-react";
import { CatMascot } from "./CatMascot";
import { Paw } from "./Paw";
import {
	Blob, Eyebrow, FloatingItem, Headline, HeroSection, HeroText, Layer, Lead,
	PawPrint, PawTrail, PriceTag, RotatingWord, Stage,
} from "@/styles/styledLanding";
import palette from "@/theme/colorPalette";

// "프랑스 생활, 지금 ___ 필요하냥?": the rotating words, one per section,
// are home.hero.words separated by "|" (one editable text).
function splitWords(text: string): string[] {
	const words = text.split("|").map(w => w.trim()).filter(Boolean);
	return words.length ? words : [""];
}

// What the sections hold, floating around the mascot. SVG icons rather
// than emoji so they look the same on every device.
const ITEMS: { Icon: LucideIcon; color: string; top: string; left: string; delay: number; rot: number; depth: number; size?: number; price?: string }[] = [
	{ Icon: ShoppingBag, color: palette.primary, top: "6%", left: "8%", delay: 0, rot: -6, depth: 18, price: "€230" },
	{ Icon: BedDouble, color: "#0a5c8a", top: "4%", left: "70%", delay: 1.2, rot: 5, depth: 26, size: 72, price: "perMonth" },
	{ Icon: MessageCircleQuestion, color: "#b0306a", top: "44%", left: "-2%", delay: 0.6, rot: 8, depth: 30, price: "answers" },
	{ Icon: Briefcase, color: "#8a4b00", top: "52%", left: "80%", delay: 1.8, rot: -8, depth: 22, price: "€12.8/h" },
	{ Icon: Soup, color: palette.furDark, top: "78%", left: "14%", delay: 2.4, rot: 6, depth: 14, size: 56 },
	{ Icon: Sofa, color: palette.pink, top: "80%", left: "66%", delay: 0.9, rot: -4, depth: 20, size: 56 },
];

// image: an admin-chosen picture (/admin/site) shown instead of the mascot.
export function LandingHero({ image }: { image?: string }) {
	const t = useTranslations("home.hero");
	const words = splitWords(t("words"));
	const [word, setWord] = useState(0);
	const stage = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const id = setInterval(() => setWord(w => w + 1), 2200);
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
				<Eyebrow><Paw /> {t("eyebrow")}</Eyebrow>
				<Headline>
					{t.rich("headline", {
						br: () => <br />,
						// Text inside <word>…</word> (French " ?") stays on the word's line.
						word: chunks => (
							<span style={{ whiteSpace: "nowrap" }}>
								<RotatingWord key={word}>{words[word % words.length]}</RotatingWord>
								{chunks}
							</span>
						),
					})}
				</Headline>
				<Lead>{t("lead")}</Lead>
			</HeroText>

			<Stage ref={stage} aria-hidden="true">
				{ITEMS.map(it => (
					<Layer key={it.top + it.left} $depth={it.depth}>
						<FloatingItem $top={it.top} $left={it.left} $delay={it.delay} $rot={it.rot} $size={it.size}>
							<it.Icon style={{ color: it.color }} strokeWidth={1.8} />
							{it.price && <PriceTag>{it.price.startsWith("€") ? it.price : t(it.price as "perMonth" | "answers")}</PriceTag>}
						</FloatingItem>
					</Layer>
				))}
				<Layer $depth={-8}>
					<div style={{ position: "absolute", inset: "14% 18% 0" }}>
						{image
							? <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
							: <CatMascot />}
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
