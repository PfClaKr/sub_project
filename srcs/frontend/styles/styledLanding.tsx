'use client';

import Link from "next/link";
import styled, { css, keyframes } from "styled-components";
import palette, { radius, shadow, breakpoint } from "@/theme/colorPalette";

// Only transform/opacity are animated so it stays smooth on phones.
// globalStyles turns every animation off under prefers-reduced-motion.

const drift = keyframes`
	0%, 100% { transform: translate(0, 0) scale(1); }
	50% { transform: translate(24px, -18px) scale(1.08); }
`;
const float = keyframes`
	0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
	50% { transform: translateY(-12px) rotate(calc(var(--r, 0deg) * -1)); }
`;
const wordIn = keyframes`
	from { opacity: 0; transform: translateY(60%); filter: blur(4px); }
	to { opacity: 1; transform: translateY(0); filter: blur(0); }
`;
const pawStep = keyframes`
	0%, 8% { opacity: 0; transform: scale(0.6) rotate(var(--r)); }
	14%, 60% { opacity: 1; transform: scale(1) rotate(var(--r)); }
	80%, 100% { opacity: 0; transform: scale(1) rotate(var(--r)); }
`;
const pop = keyframes`
	0% { opacity: 0; transform: translateY(16px) scale(0.96); }
	100% { opacity: 1; transform: translateY(0) scale(1); }
`;

export const HeroSection = styled.section`
	position: relative;
	overflow: hidden;
	display: grid;
	grid-template-columns: 1.1fr 0.9fr;
	align-items: center;
	gap: 24px;
	min-height: 460px;
	padding: 48px 48px 56px;
	margin-bottom: 20px;
	border-radius: 28px;
	background: linear-gradient(135deg, ${palette.skySoft} 0%, #ffffff 55%, ${palette.pinkSoft} 100%);
	isolation: isolate;

	@media (max-width: ${breakpoint.md}) {
		grid-template-columns: 1fr;
		padding: 32px 20px 28px;
		min-height: 0;
		text-align: center;
	}
`;

export const Blob = styled.div<{ $color: string; $size: number; $top: string; $left: string; $delay?: number }>`
	position: absolute;
	z-index: -1;
	top: ${p => p.$top};
	left: ${p => p.$left};
	width: ${p => p.$size}px;
	height: ${p => p.$size}px;
	border-radius: 50%;
	background: ${p => p.$color};
	filter: blur(50px);
	opacity: 0.55;
	animation: ${drift} 14s ease-in-out ${p => p.$delay ?? 0}s infinite;
`;

export const HeroText = styled.div`
	position: relative;
	z-index: 1;
	animation: ${pop} 0.7s ease-out both;
`;

export const Eyebrow = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 6px 12px;
	border-radius: 999px;
	background: rgba(255, 255, 255, 0.8);
	border: 1px solid ${palette.border};
	color: ${palette.primary};
	font-size: 13px;
	font-weight: 700;

	svg {
		width: 15px;
		height: 15px;
		color: ${palette.pink};
	}
`;

export const Headline = styled.h1`
	margin: 18px 0 12px;
	font-size: clamp(30px, 5vw, 52px);
	line-height: 1.15;
	letter-spacing: -0.02em;
`;

export const RotatingWord = styled.span`
	display: inline-block;
	background: linear-gradient(90deg, ${palette.primary}, ${palette.pink});
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
	animation: ${wordIn} 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
`;

export const Lead = styled.p`
	margin: 0 0 24px;
	font-size: 17px;
	color: ${palette.muted};

	@media (max-width: ${breakpoint.md}) {
		font-size: 15px;
	}
`;

export const QuickLinks = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin-top: 14px;
	font-size: 13px;
	color: ${palette.muted};

	@media (max-width: ${breakpoint.md}) {
		justify-content: center;
	}

	a {
		padding: 4px 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.75);
		border: 1px solid ${palette.border};
		text-decoration: none;
		color: ${palette.text};
		transition: transform 0.15s, border-color 0.15s;
	}
	a:hover {
		transform: translateY(-2px);
		border-color: ${palette.pink};
	}
`;

// Pointer parallax: the hero sets --mx/--my in [-1, 1]; each layer moves
// by its own depth.
export const Stage = styled.div`
	position: relative;
	height: 380px;
	--mx: 0;
	--my: 0;

	@media (max-width: ${breakpoint.md}) {
		height: 250px;
		max-width: 360px;
		width: 100%;
		margin: 0 auto;
	}
`;

export const Layer = styled.div<{ $depth: number }>`
	position: absolute;
	inset: 0;
	transform: translate3d(calc(var(--mx) * ${p => p.$depth}px), calc(var(--my) * ${p => p.$depth}px), 0);
	transition: transform 0.25s ease-out;
`;

export const FloatingItem = styled.div<{ $top: string; $left: string; $delay: number; $rot: number; $size?: number }>`
	position: absolute;
	top: ${p => p.$top};
	left: ${p => p.$left};
	width: ${p => p.$size ?? 64}px;
	height: ${p => p.$size ?? 64}px;
	display: grid;
	place-items: center;
	font-size: ${p => Math.round((p.$size ?? 64) * 0.5)}px;
	background: #ffffff;
	border-radius: 18px;
	box-shadow: ${shadow.hover};
	--r: ${p => p.$rot}deg;

	> svg {
		width: 48%;
		height: 48%;
	}
	animation: ${float} ${p => 4 + (p.$delay % 3)}s ease-in-out ${p => p.$delay}s infinite;

	@media (max-width: ${breakpoint.md}) {
		width: ${p => Math.round((p.$size ?? 64) * 0.75)}px;
		height: ${p => Math.round((p.$size ?? 64) * 0.75)}px;
		font-size: ${p => Math.round((p.$size ?? 64) * 0.38)}px;
		border-radius: 14px;
	}
`;

export const PriceTag = styled.span`
	position: absolute;
	bottom: -10px;
	right: -14px;
	padding: 2px 8px;
	border-radius: 999px;
	background: ${palette.primary};
	color: #ffffff;
	font-size: 11px;
	font-weight: 800;
	white-space: nowrap;
`;

export const PawTrail = styled.div`
	position: absolute;
	left: 0;
	right: 0;
	bottom: 10px;
	height: 40px;
	pointer-events: none;
	z-index: -1;
`;

export const PawPrint = styled.span<{ $i: number; $count: number }>`
	position: absolute;
	left: ${p => 4 + p.$i * (92 / p.$count)}%;
	bottom: ${p => (p.$i % 2 ? 4 : 18)}px;
	width: 22px;
	height: 22px;
	opacity: 0;
	color: ${palette.pink};
	--r: ${p => (p.$i % 2 ? 100 : 80)}deg;
	animation: ${pawStep} 6s ease-in-out ${p => p.$i * 0.35}s infinite;

	svg {
		width: 100%;
		height: 100%;
	}
`;

// ---- sections ----

export const StatsStrip = styled.section`
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 12px;
	margin: 0 0 40px;

	@media (max-width: ${breakpoint.sm}) {
		gap: 8px;
	}
`;

export const Stat = styled.div`
	padding: 18px 12px;
	text-align: center;
	border-radius: ${radius.lg};
	background: ${palette.surface};

	strong {
		display: block;
		font-size: clamp(24px, 4vw, 34px);
		font-weight: 800;
		color: ${palette.heading};
		font-variant-numeric: tabular-nums;
	}
	/* Only the label; the number inside <strong> is a span too. */
	> span {
		font-size: 13px;
		color: ${palette.muted};
	}
`;

export const SectionHead = styled.div`
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 12px;
	margin: 48px 0 16px;

	h2 {
		margin: 0;
		font-size: clamp(20px, 3vw, 26px);
	}
	p {
		margin: 4px 0 0;
		color: ${palette.muted};
	}
`;

export const TileGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(6, 1fr);
	gap: 12px;

	@media (max-width: ${breakpoint.md}) {
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
`;

const wiggle = keyframes`
	0%, 100% { transform: rotate(0); }
	25% { transform: rotate(-12deg) scale(1.1); }
	75% { transform: rotate(10deg) scale(1.1); }
`;

export const Tile = styled(Link)<{ $active?: boolean }>`
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
	padding: 16px 8px;
	border-radius: ${radius.lg};
	text-decoration: none;
	font-weight: 700;
	font-size: 14px;
	background: ${p => (p.$active ? palette.primarySoft : palette.bg)};
	border: 1px solid ${p => (p.$active ? palette.primary : palette.border)};
	transition: transform 0.2s, box-shadow 0.2s;

	span {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		background: ${palette.skySoft};
		color: ${palette.primary};
	}
	span svg {
		width: 26px;
		height: 26px;
	}
	&:hover {
		transform: translateY(-4px);
		box-shadow: ${shadow.hover};
	}
	&:hover span {
		animation: ${wiggle} 0.5s ease-in-out;
	}
`;

export const Steps = styled.ol`
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 16px;
	margin: 0;
	padding: 0;
	list-style: none;

	@media (max-width: ${breakpoint.md}) {
		grid-template-columns: 1fr;
	}
`;

export const StepCard = styled.li`
	position: relative;
	height: 100%;
	padding: 24px 22px;
	border-radius: ${radius.lg};
	background: ${palette.bg};
	border: 1px solid ${palette.border};

	em {
		position: absolute;
		top: 16px;
		right: 18px;
		font-style: normal;
		font-size: 44px;
		font-weight: 900;
		color: ${palette.skySoft};
	}
	i {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 16px;
		font-style: normal;
		color: ${palette.pink};
		background: ${palette.pinkSoft};
		transition: transform 0.3s;
	}
	i svg {
		width: 26px;
		height: 26px;
	}
	&:hover i {
		transform: rotate(-8deg) scale(1.08);
	}
	h3 {
		margin: 14px 0 6px;
		font-size: 18px;
	}
	p {
		margin: 0;
		color: ${palette.muted};
		font-size: 14px;
	}
`;

export const CtaBand = styled.section`
	position: relative;
	overflow: hidden;
	margin-top: 56px;
	padding: 40px 32px;
	border-radius: 28px;
	text-align: center;
	color: #ffffff;
	background: linear-gradient(120deg, ${palette.primary}, #3a6fe0 55%, ${palette.pink});
	isolation: isolate;

	h2 {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		margin: 0 0 8px;
		color: #ffffff;
	}
	h2 svg {
		width: 28px;
		height: 28px;
		color: ${palette.pinkSoft};
		font-size: clamp(22px, 3.4vw, 32px);
	}
	p {
		margin: 0 0 20px;
		opacity: 0.9;
	}
`;

export const CtaButton = styled(Link)`
	display: inline-block;
	padding: 13px 26px;
	border-radius: 999px;
	background: #ffffff;
	color: ${palette.primary};
	font-weight: 800;
	text-decoration: none;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
	transition: transform 0.2s;

	&:hover {
		transform: translateY(-2px) scale(1.03);
	}
`;

// Scroll reveal; the Reveal component flips $visible once in view.
export const RevealBox = styled.div<{ $visible: boolean; $delay: number }>`
	opacity: 0;
	transform: translateY(24px);
	transition: opacity 0.6s ease-out, transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);
	transition-delay: ${p => p.$delay}ms;

	${p => p.$visible && css`
		opacity: 1;
		transform: none;
	`}
`;
