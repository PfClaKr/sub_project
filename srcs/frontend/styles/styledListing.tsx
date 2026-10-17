'use client';

import styled from "styled-components";
import palette, { breakpoint, radius } from "@/theme/colorPalette";

export const ListingCards = styled.ul`
	margin: 0;
	padding: 0;
	list-style: none;
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
	gap: 12px;

	@media (max-width: ${breakpoint.sm}) {
		grid-template-columns: 1fr;
	}
`;

export const ListingCard = styled.a<{ $closed?: boolean }>`
	display: flex;
	gap: 14px;
	height: 100%;
	padding: 12px;
	border: 1px solid ${palette.border};
	border-radius: ${radius.lg};
	color: ${palette.text};
	text-decoration: none;
	opacity: ${p => (p.$closed ? 0.6 : 1)};

	&:hover {
		border-color: ${palette.primary};
	}
	.thumb {
		flex: none;
		width: 104px;
		height: 104px;
		border-radius: ${radius.md};
		object-fit: cover;
		background-color: ${palette.surface};
		display: grid;
		place-items: center;
		color: ${palette.muted};
	}
	h3 {
		margin: 4px 0;
		font-size: 15px;
		line-height: 1.35;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	strong {
		display: block;
		font-size: 16px;
		color: ${palette.heading};
	}
	> div {
		min-width: 0;
		flex: 1;
	}
`;

export const ViewToggle = styled.div`
	display: inline-flex;
	border: 1px solid ${palette.border};
	border-radius: 999px;
	overflow: hidden;

	button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 7px 12px;
		border: 0;
		border-radius: 0;
		font-size: 14px;
		background: ${palette.bg};
		color: ${palette.text};
	}
	button[aria-pressed="true"] {
		background: ${palette.primary};
		color: #ffffff;
	}
`;

export const SafetyBanner = styled.aside`
	display: flex;
	gap: 10px;
	align-items: flex-start;
	padding: 12px 14px;
	border-radius: ${radius.md};
	background-color: ${palette.warningSoft};
	color: ${palette.warning};
	font-size: 14px;
	line-height: 1.5;

	svg {
		flex: none;
		margin-top: 2px;
	}
	a {
		color: inherit;
		font-weight: 700;
	}
`;

export const OwnerPanel = styled.section`
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 14px;
	border: 1px dashed ${palette.border};
	border-radius: ${radius.md};
	font-size: 14px;

	> div {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	select {
		width: auto;
	}
`;

export const CheckRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 8px;

	label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border: 1px solid ${palette.border};
		border-radius: 999px;
		font-size: 14px;
		cursor: pointer;
	}
	label:has(input:checked) {
		border-color: ${palette.primary};
		background-color: ${palette.primarySoft};
		color: ${palette.primary};
	}
	input {
		width: auto;
	}
`;

export const MapPanel = styled.div`
	height: 520px;
	border-radius: ${radius.lg};
	overflow: hidden;

	@media (max-width: ${breakpoint.sm}) {
		height: 420px;
	}
`;
