'use client';

import styled from "styled-components";
import palette, { radius, shadow, breakpoint } from "@/theme/colorPalette";

export const Grid = styled.ul`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	gap: 20px;
	margin: 0;
	padding: 0;
	list-style: none;

	@media (max-width: ${breakpoint.sm}) {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}
`;

export const Card = styled.article<{ $dimmed?: boolean }>`
	height: 100%;
	border-radius: ${radius.md};
	background-color: ${palette.bg};
	box-shadow: ${shadow.card};
	overflow: hidden;
	transition: box-shadow 0.15s, transform 0.15s;
	opacity: ${p => (p.$dimmed ? 0.6 : 1)};

	&:hover {
		box-shadow: ${shadow.hover};
		transform: translateY(-2px);
	}
`;

export const ThumbContainer = styled.div`
	position: relative;
	aspect-ratio: 1 / 1;
	background-color: ${palette.surface};

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
`;

export const NoImage = styled.div`
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	color: ${palette.muted};
	font-size: 13px;
`;

export const BadgeSlot = styled.div`
	position: absolute;
	top: 8px;
	left: 8px;
`;

export const InfoContainer = styled.div`
	padding: 10px 12px 14px;
	display: flex;
	flex-direction: column;
	gap: 2px;
`;

export const Title = styled.h3`
	margin: 0;
	font-size: 15px;
	font-weight: 600;
	color: ${palette.text};
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

export const Price = styled.div`
	font-size: 17px;
	font-weight: 800;
	color: ${palette.heading};
`;

export const Subtitle = styled.div`
	font-size: 13px;
	color: ${palette.muted};
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;
