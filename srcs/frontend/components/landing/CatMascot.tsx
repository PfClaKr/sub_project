'use client';

import styled, { keyframes } from "styled-components";
import palette from "@/theme/colorPalette";

const wag = keyframes`
	0%, 100% { transform: rotate(-6deg); }
	50% { transform: rotate(14deg); }
`;
const blink = keyframes`
	0%, 92%, 100% { transform: scaleY(1); }
	95% { transform: scaleY(0.1); }
`;
const bob = keyframes`
	0%, 100% { transform: translateY(0) rotate(0); }
	50% { transform: translateY(-4px) rotate(-2deg); }
`;
const breathe = keyframes`
	0%, 100% { transform: scale(1); }
	50% { transform: scale(1.02, 0.98); }
`;

// transform-box: fill-box makes each part rotate around its own box.
const Svg = styled.svg`
	width: 100%;
	height: 100%;
	overflow: visible;

	.tail {
		transform-box: fill-box;
		transform-origin: 0% 100%;
		animation: ${wag} 1.6s ease-in-out infinite;
	}
	.head {
		transform-box: fill-box;
		transform-origin: 50% 90%;
		animation: ${bob} 3.2s ease-in-out infinite;
	}
	.eye {
		transform-box: fill-box;
		transform-origin: center;
		animation: ${blink} 4.5s infinite;
	}
	.body {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		animation: ${breathe} 3.2s ease-in-out infinite;
	}
`;

// 잇냥's mascot: a tabby wearing a Paris beret.
export function CatMascot() {
	const fur = palette.fur;
	const dark = palette.furDark;
	return (
		<Svg viewBox="0 0 240 240" role="img" aria-label="베레모를 쓴 잇냥 고양이">
			<ellipse cx="120" cy="226" rx="70" ry="9" fill="rgba(16,23,80,0.08)" />
			<path className="tail" d="M168 196 C 214 190, 222 138, 196 118" stroke={dark} strokeWidth="15" strokeLinecap="round" fill="none" />
			<g className="body">
				<ellipse cx="120" cy="182" rx="60" ry="46" fill={fur} />
				<ellipse cx="120" cy="192" rx="34" ry="30" fill="#fff4e8" />
				<path d="M82 160 q10 -6 18 0 M140 160 q10 -6 18 0" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />
				<ellipse cx="96" cy="222" rx="16" ry="9" fill={fur} />
				<ellipse cx="144" cy="222" rx="16" ry="9" fill={fur} />
				{/* scarf in the brand blue */}
				<path d="M78 146 q42 22 84 0 l-4 14 q-38 18 -76 0 z" fill={palette.primary} />
				<path d="M140 156 l10 30 l-14 -4 z" fill={palette.primary} />
			</g>
			<g className="head">
				<polygon points="74,86 80,40 112,68" fill={fur} />
				<polygon points="166,86 160,40 128,68" fill={fur} />
				<polygon points="82,76 85,52 104,68" fill={palette.pink} />
				<polygon points="158,76 155,52 136,68" fill={palette.pink} />
				<circle cx="120" cy="104" r="52" fill={fur} />
				<path d="M104 60 q16 10 32 0 M100 70 q20 12 40 0" stroke={dark} strokeWidth="4" fill="none" strokeLinecap="round" />
				{/* beret */}
				<ellipse cx="114" cy="58" rx="46" ry="15" fill={palette.heading} transform="rotate(-10 114 58)" />
				<circle cx="112" cy="42" r="5" fill={palette.heading} />
				<ellipse className="eye" cx="100" cy="106" rx="6.5" ry="9" fill={palette.text} />
				<ellipse className="eye" cx="140" cy="106" rx="6.5" ry="9" fill={palette.text} />
				<circle cx="102" cy="102" r="2.2" fill="#fff" />
				<circle cx="142" cy="102" r="2.2" fill="#fff" />
				<circle cx="88" cy="124" r="8" fill={palette.pink} opacity="0.45" />
				<circle cx="152" cy="124" r="8" fill={palette.pink} opacity="0.45" />
				<path d="M115 118 h10 l-5 6 z" fill={palette.pink} />
				<path d="M112 128 q4 5 8 0 q4 5 8 0" stroke={palette.text} strokeWidth="2.4" fill="none" strokeLinecap="round" />
				<path d="M62 116 l26 3 M62 128 l26 -2 M178 116 l-26 3 M178 128 l-26 -2" stroke={dark} strokeWidth="2" strokeLinecap="round" />
			</g>
		</Svg>
	);
}
