'use client';

import styled from "styled-components";
import palette, { radius } from "@/theme/colorPalette";

export const Segmented = styled.div`
	display: inline-flex;
	padding: 3px;
	border-radius: 999px;
	background-color: ${palette.surface};
	border: 1px solid ${palette.border};

	button {
		padding: 7px 14px;
		border-radius: 999px;
		background: none;
		color: ${palette.text};
		font-weight: 600;
	}
	button:hover:not(:disabled) {
		background: none;
		color: ${palette.primary};
	}
	button[aria-pressed="true"] {
		background-color: ${palette.bg};
		color: ${palette.primary};
		box-shadow: 0 1px 3px rgba(16, 23, 80, 0.15);
	}
`;

export const MapBox = styled.div<{ $h?: number }>`
	height: ${p => p.$h ?? 320}px;
	border-radius: ${radius.md};
	overflow: hidden;
	border: 1px solid ${palette.border};
`;

export const PlaceSearch = styled.div`
	position: relative;
	display: flex;
	gap: 8px;

	> input {
		flex: 1;
		min-width: 0;
	}
`;

export const PlaceResults = styled.ul`
	position: absolute;
	z-index: 30;
	top: calc(100% + 4px);
	left: 0;
	right: 0;
	margin: 0;
	padding: 4px 0;
	list-style: none;
	background: ${palette.bg};
	border: 1px solid ${palette.border};
	border-radius: ${radius.md};
	box-shadow: 0 8px 24px rgba(16, 23, 80, 0.12);

	button {
		display: block;
		width: 100%;
		text-align: left;
		padding: 8px 14px;
		border-radius: 0;
		background: none;
		color: ${palette.text};
		font-weight: 400;
	}
	button:hover:not(:disabled) {
		background-color: ${palette.primarySoft};
	}
	strong {
		display: block;
		font-size: 14px;
	}
	small {
		display: block;
		color: ${palette.muted};
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const RadiusChips = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 6px;

	button {
		padding: 5px 12px;
		border-radius: 999px;
		background: ${palette.bg};
		color: ${palette.text};
		border: 1px solid ${palette.border};
		font-weight: 600;
	}
	button:hover:not(:disabled) {
		background: ${palette.primarySoft};
	}
	button[aria-pressed="true"],
	button[aria-pressed="true"]:hover:not(:disabled) {
		background: ${palette.primary};
		border-color: ${palette.primary};
		color: #ffffff;
	}
`;

export const LocationSummary = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	margin-top: 10px;
	font-size: 14px;
	color: ${palette.muted};
`;
