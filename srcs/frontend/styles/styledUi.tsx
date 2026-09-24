'use client';

import Link from "next/link";
import styled, { css, keyframes } from "styled-components";
import palette, { radius } from "@/theme/colorPalette";

export const GhostButton = styled.button`
	background-color: ${palette.bg};
	color: ${palette.primary};
	border-color: ${palette.border};

	&:hover:not(:disabled) {
		background-color: ${palette.primarySoft};
	}
`;

export const DangerButton = styled(GhostButton)`
	color: ${palette.danger};

	&:hover:not(:disabled) {
		background-color: ${palette.dangerSoft};
	}
`;

const buttonLike = css`
	display: inline-block;
	padding: 9px 16px;
	border-radius: ${radius.sm};
	font-weight: 600;
	font-size: 14px;
	text-decoration: none;
	text-align: center;
`;

export const LinkButton = styled(Link)<{ $ghost?: boolean }>`
	${buttonLike}
	background-color: ${p => (p.$ghost ? palette.bg : palette.primary)};
	color: ${p => (p.$ghost ? palette.primary : "#ffffff")};
	border: 1px solid ${p => (p.$ghost ? palette.border : "transparent")};

	&:hover {
		background-color: ${p => (p.$ghost ? palette.primarySoft : palette.primaryHover)};
	}
`;

export const Chip = styled(Link)<{ $active?: boolean }>`
	display: inline-block;
	padding: 6px 14px;
	border-radius: 999px;
	font-size: 14px;
	text-decoration: none;
	white-space: nowrap;
	border: 1px solid ${p => (p.$active ? palette.primary : palette.border)};
	background-color: ${p => (p.$active ? palette.primary : palette.bg)};
	color: ${p => (p.$active ? "#ffffff" : palette.text)};

	&:hover {
		border-color: ${palette.primary};
	}
`;

export const ChipRow = styled.nav`
	display: flex;
	gap: 8px;
	overflow-x: auto;
	padding-bottom: 4px;
	margin-bottom: 20px;
	scrollbar-width: none;
`;

const statusColors: Record<string, [string, string]> = {
	"예약중": [palette.warning, palette.warningSoft],
	"판매완료": [palette.done, palette.doneSoft],
};

export const StatusBadge = styled.span<{ $status: string }>`
	display: inline-block;
	padding: 2px 8px;
	border-radius: ${radius.sm};
	font-size: 12px;
	font-weight: 700;
	color: ${p => statusColors[p.$status]?.[0] ?? palette.primary};
	background-color: ${p => statusColors[p.$status]?.[1] ?? palette.primarySoft};
`;

export const EmptyState = styled.div`
	padding: 48px 16px;
	text-align: center;
	color: ${palette.muted};
	background-color: ${palette.surface};
	border-radius: ${radius.md};

	p {
		margin: 0 0 16px;
	}
	p:last-child {
		margin-bottom: 0;
	}
`;

export const ErrorText = styled.p`
	color: ${palette.danger};
	font-size: 14px;
	margin: 0;
`;

export const Muted = styled.span`
	color: ${palette.muted};
	font-size: 14px;
`;

const shimmer = keyframes`
	from { background-position: -200px 0; }
	to { background-position: calc(200px + 100%) 0; }
`;

export const Skeleton = styled.div<{ $h?: string; $w?: string }>`
	height: ${p => p.$h ?? "16px"};
	width: ${p => p.$w ?? "100%"};
	border-radius: ${radius.sm};
	background: ${palette.surface}
		linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent)
		no-repeat;
	background-size: 200px 100%;
	animation: ${shimmer} 1.2s infinite;
`;

export const AvatarCircle = styled.div<{ $size: number }>`
	flex: none;
	width: ${p => p.$size}px;
	height: ${p => p.$size}px;
	border-radius: 50%;
	overflow: hidden;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
	font-size: ${p => Math.round(p.$size * 0.42)}px;
	color: ${palette.primary};
	background-color: ${palette.primarySoft};

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
`;

export const Pagination = styled.nav`
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 12px;
	margin-top: 32px;
	color: ${palette.muted};
	font-size: 14px;
`;

// Clickable avatar with a camera badge (profile photo upload).
export const AvatarPicker = styled.label`
	position: relative;
	flex: none;
	cursor: pointer;
	border-radius: 50%;
	transition: transform 0.15s;

	&:hover {
		transform: scale(1.03);
	}
	&:focus-within {
		outline: 2px solid ${palette.accent};
		outline-offset: 3px;
	}
	&[aria-busy="true"] {
		opacity: 0.6;
		pointer-events: none;
	}
	.badge {
		position: absolute;
		right: -2px;
		bottom: -2px;
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 2px solid ${palette.bg};
		color: #ffffff;
		background: ${palette.primary};
	}
`;
