'use client';

import styled, { css, keyframes } from "styled-components";
import palette, { radius, breakpoint } from "@/theme/colorPalette";

export const DropZone = styled.div<{ $active: boolean; $compact: boolean }>`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 8px;
	padding: ${p => (p.$compact ? "0" : "32px 16px")};
	border: 2px dashed ${p => (p.$active ? palette.primary : palette.border)};
	border-radius: ${radius.lg};
	background: ${p => (p.$active ? palette.primarySoft : palette.surface)};
	text-align: center;
	cursor: pointer;
	transition: border-color 0.15s, background-color 0.15s;

	&:hover {
		border-color: ${palette.accent};
	}
	&:focus-visible {
		outline: 2px solid ${palette.accent};
		outline-offset: 2px;
	}

	strong {
		color: ${palette.heading};
		font-size: 15px;
	}
	small {
		color: ${palette.muted};
		font-size: 12px;
	}
`;

export const DropIcon = styled.span`
	display: grid;
	place-items: center;
	width: 52px;
	height: 52px;
	border-radius: 16px;
	color: ${palette.primary};
	background: ${palette.bg};
	box-shadow: 0 2px 8px rgba(16, 23, 80, 0.08);
`;

export const TileGrid = styled.ul`
	display: grid;
	grid-template-columns: repeat(5, minmax(0, 1fr));
	gap: 10px;
	margin: 0;
	padding: 0;
	list-style: none;

	@media (max-width: ${breakpoint.sm}) {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
`;

const spin = keyframes`
	to { transform: rotate(360deg); }
`;

export const PhotoTile = styled.li<{ $dragging?: boolean; $over?: boolean }>`
	position: relative;
	aspect-ratio: 1 / 1;
	border-radius: ${radius.md};
	overflow: hidden;
	background: ${palette.surface};
	cursor: grab;
	outline: 2px solid ${p => (p.$over ? palette.primary : "transparent")};
	outline-offset: 2px;
	opacity: ${p => (p.$dragging ? 0.4 : 1)};
	transition: opacity 0.15s, outline-color 0.15s;

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		pointer-events: none;
	}

	/* Actions appear on hover (always visible on touch screens). */
	.actions {
		position: absolute;
		inset: auto 6px 6px 6px;
		display: flex;
		justify-content: space-between;
		opacity: 0;
		transition: opacity 0.15s;
	}
	&:hover .actions, &:focus-within .actions {
		opacity: 1;
	}
	@media (hover: none) {
		.actions {
			opacity: 1;
		}
	}
`;

export const TileButton = styled.button`
	width: 30px;
	height: 30px;
	padding: 0;
	border-radius: 50%;
	background: rgba(16, 23, 80, 0.72);
	color: #ffffff;
	backdrop-filter: blur(2px);

	&:hover:not(:disabled) {
		background: rgba(16, 23, 80, 0.9);
	}
`;

export const CoverBadge = styled.span`
	position: absolute;
	top: 6px;
	left: 6px;
	padding: 2px 8px;
	border-radius: 999px;
	font-size: 11px;
	font-weight: 800;
	color: #ffffff;
	background: ${palette.primary};
`;

export const Uploading = styled.span`
	position: absolute;
	inset: 0;
	display: grid;
	place-items: center;
	background: rgba(255, 255, 255, 0.6);

	&::after {
		content: "";
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 3px solid ${palette.primarySoft};
		border-top-color: ${palette.primary};
		animation: ${spin} 0.8s linear infinite;
	}
`;

export const AddTile = styled.li`
	aspect-ratio: 1 / 1;

	button {
		width: 100%;
		height: 100%;
		flex-direction: column;
		gap: 4px;
		border: 2px dashed ${palette.border};
		border-radius: ${radius.md};
		background: ${palette.surface};
		color: ${palette.muted};
		font-size: 12px;
		font-weight: 600;
	}
	button:hover:not(:disabled) {
		border-color: ${palette.accent};
		background: ${palette.primarySoft};
		color: ${palette.primary};
	}
`;

export const UploaderFoot = styled.div<{ $warn?: boolean }>`
	display: flex;
	justify-content: space-between;
	gap: 8px;
	margin-top: 8px;
	font-size: 12px;
	color: ${palette.muted};

	${p => p.$warn && css`
		color: ${palette.danger};
	`}
`;
