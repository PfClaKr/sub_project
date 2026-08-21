'use client';

import AppTheme from "@/theme/ui";
import palette from "@/theme/colorPalette";
import styled from "styled-components";

export const Card = styled.div`
	display: flex;
	flex-direction: column;
	border-radius: 10px;
	overflow: hidden;
	background-color: ${palette.bg.default};
	border: 1px solid ${palette.line};
	transition: transform 0.15s ease, box-shadow 0.15s ease;

	&:hover {
		transform: translateY(-2px);
		box-shadow: 0 10px 24px ${palette.shadow};
	}
`;

export const ThumbContainer = styled.div<{ $soldout?: boolean }>`
	position: relative;
	width: 100%;
	aspect-ratio: 1 / 1;
	background-color: ${palette.bg[300]};

	${p => p.$soldout && `
		img { filter: grayscale(60%) brightness(0.7); }
	`}
`;

export const Thumb = styled.img`
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
`;

export const StatusBadge = styled.div`
	position: absolute;
	top: 8px;
	left: 8px;
	padding: 3px 10px;
	border-radius: 12px;
	font-size: 12px;
	font-weight: 700;
	color: #ffffff;
	background-color: ${palette.fg[700]};
	opacity: 0.92;
`;

export const InfoContainer = styled.div`
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 12px 14px 14px;
`;

export const Title = styled.div`
	color: ${palette.fg.default};
	font-size: 15px;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	min-height: 2.9em;
`;

export const Price = styled.div`
	color: ${AppTheme.product.text.primary.color};
	font-size: 18px;
	font-weight: 800;
`;

export const Subtitle = styled.div`
	display: flex;
	justify-content: space-between;
	gap: 8px;
	color: ${AppTheme.product.text.sub.color};
	font-size: 13px;

	div {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;
