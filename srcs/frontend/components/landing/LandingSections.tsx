'use client';

import { BookOpen, Camera, MapPin, MessageCircle, Package, Shirt, Smartphone, Sofa, Soup, type LucideIcon } from "lucide-react";
import { CountUp } from "./CountUp";
import { Paw } from "./Paw";
import { Reveal } from "./Reveal";
import { CtaBand, CtaButton, SectionHead, Stat, StatsStrip, StepCard, Steps, Tile, TileGrid } from "@/styles/styledLanding";
import { CATEGORIES } from "@/libs/constants";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
	전자기기: Smartphone, 가구: Sofa, 의류: Shirt, 도서: BookOpen, 식품: Soup, 기타: Package,
};

export function MarketStats({ stats }: { stats: { Products: number; Selling: number; Users: number } | null }) {
	if (!stats) return null;
	const items = [
		{ label: "등록된 물건", value: stats.Products },
		{ label: "지금 판매중", value: stats.Selling },
		{ label: "잇냥 이웃", value: stats.Users },
	];
	return (
		<StatsStrip aria-label="잇냥 현황">
			{items.map((s, i) => (
				<Reveal key={s.label} delay={i * 90}>
					<Stat>
						<strong><CountUp value={s.value} /></strong>
						<span>{s.label}</span>
					</Stat>
				</Reveal>
			))}
		</StatsStrip>
	);
}

export function CategoryTiles({ active }: { active?: string }) {
	return (
		<section aria-labelledby="categories">
			<SectionHead><h2 id="categories">카테고리로 둘러보기</h2></SectionHead>
			<TileGrid>
				{CATEGORIES.map((c, i) => {
					const Icon = CATEGORY_ICONS[c];
					return (
					<Reveal key={c} delay={i * 50}>
						<Tile href={`/?category=${encodeURIComponent(c)}#recent`} $active={active === c} scroll={false}>
							<span aria-hidden="true"><Icon /></span>
							{c}
						</Tile>
					</Reveal>
					);
				})}
			</TileGrid>
		</section>
	);
}

const STEPS = [
	{ Icon: Camera, title: "사진 찍어 올리기", body: "사진 몇 장과 가격만 적으면 끝. 거래 장소는 정확한 위치나 동네(구)만 표시하도록 고를 수 있어요." },
	{ Icon: MessageCircle, title: "채팅으로 약속", body: "마음에 드는 물건이 있으면 바로 채팅. 판매자와 시간과 장소를 정해요." },
	{ Icon: MapPin, title: "가까운 곳에서 직거래", body: "지도에서 가까운 물건부터 찾아보고, 역이나 공공장소에서 안전하게 만나요." },
];

export function HowItWorks() {
	return (
		<section aria-labelledby="how">
			<SectionHead>
				<div>
					<h2 id="how">잇냥은 이렇게 써요</h2>
					<p>수수료 없이, 한국어로, 동네에서.</p>
				</div>
			</SectionHead>
			<Steps>
				{STEPS.map((s, i) => (
					<Reveal key={s.title} delay={i * 120}>
						<StepCard>
							<em aria-hidden="true">{i + 1}</em>
							<i aria-hidden="true"><s.Icon /></i>
							<h3>{s.title}</h3>
							<p>{s.body}</p>
						</StepCard>
					</Reveal>
				))}
			</Steps>
		</section>
	);
}

export function CallToAction() {
	return (
		<Reveal>
			<CtaBand>
				<h2>안 쓰는 물건, 이웃에게 넘겨주냥 <Paw /></h2>
				<p>사진 한 장이면 충분해요. 1분 만에 올려보세요.</p>
				<CtaButton href="/sell">판매 시작하기</CtaButton>
			</CtaBand>
		</Reveal>
	);
}
