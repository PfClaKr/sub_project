'use client';

import styled, { createGlobalStyle } from "styled-components";
import palette, { radius, breakpoint } from "@/theme/colorPalette";

export const Breadcrumb = styled.nav`
	font-size: 13px;
	color: ${palette.muted};
	margin-bottom: 16px;

	a {
		color: ${palette.muted};
		text-decoration: none;
	}
	a:hover {
		color: ${palette.primary};
	}
`;

export const DetailLayout = styled.div`
	display: grid;
	grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
	gap: 32px;
	align-items: start;

	@media (max-width: ${breakpoint.md}) {
		grid-template-columns: minmax(0, 1fr);
		gap: 20px;
	}
`;

// Left column content that should follow the info panel on phones, like
// the map of a listing without photos (the title comes first).
export const SideSlot = styled.div<{ $afterOnMobile?: boolean }>`
	min-width: 0;

	@media (max-width: ${breakpoint.md}) {
		order: ${p => (p.$afterOnMobile ? 2 : 0)};
	}
`;

export const Gallery = styled.div`
	display: flex;
	flex-direction: column;
	gap: 10px;
`;

export const MainImage = styled.div`
	aspect-ratio: 1 / 1;
	border-radius: ${radius.md};
	overflow: hidden;
	background-color: ${palette.surface};

	/* One column on tablets and landscape phones: a full-width square
	   would fill the screen and push the title and price out of view. */
	@media (min-width: ${parseInt(breakpoint.sm) + 1}px) and (max-width: ${breakpoint.md}) {
		aspect-ratio: 4 / 3;
		max-height: 60vh;
	}

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
`;

export const Thumbs = styled.div`
	display: flex;
	gap: 8px;
	overflow-x: auto;

	button {
		flex: none;
		width: 64px;
		height: 64px;
		padding: 0;
		border-radius: ${radius.sm};
		overflow: hidden;
		background: none;
		border: 2px solid transparent;
	}
	button[aria-current="true"] {
		border-color: ${palette.primary};
	}
	button:hover:not(:disabled) {
		background: none;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
`;

export const InfoPanel = styled.div`
	display: flex;
	flex-direction: column;
	gap: 16px;

	h1 {
		margin: 0;
		font-size: 24px;
	}
`;

export const BigPrice = styled.div`
	font-size: 28px;
	font-weight: 800;
	color: ${palette.heading};
`;

export const Facts = styled.dl`
	display: grid;
	grid-template-columns: max-content 1fr;
	gap: 8px 16px;
	margin: 0;
	padding: 16px 0;
	border-top: 1px solid ${palette.border};
	border-bottom: 1px solid ${palette.border};
	font-size: 14px;

	dt {
		color: ${palette.muted};
	}
	dd {
		margin: 0;
	}
`;

export const Actions = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 8px;

	> * {
		flex: 1 1 140px;
	}
`;

// On phones the buyer's actions stay above the bottom tab bar while the
// page scrolls, with the price beside them.
export const StickyActions = styled(Actions)`
	.price {
		display: none;
	}

	@media (max-width: ${breakpoint.sm}) {
		position: fixed;
		left: 0;
		right: 0;
		bottom: calc(56px + env(safe-area-inset-bottom));
		z-index: 9;
		flex-wrap: nowrap;
		align-items: center;
		padding: 10px 16px;
		background-color: ${palette.bg};
		border-top: 1px solid ${palette.border};
		box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.06);

		> * {
			flex: 1 1 auto;
		}
		.price {
			display: block;
			flex: 0 0 auto;
			margin-right: 4px;
			font-size: 18px;
			font-weight: 800;
			color: ${palette.heading};
		}
	}
`;

// Keeps the end of the page clear of StickyActions on phones.
export const ReserveActionSpace = createGlobalStyle`
	@media (max-width: ${breakpoint.sm}) {
		body {
			padding-bottom: 64px;
		}
	}
`;

export const Description = styled.section`
	margin-top: 36px;

	h2 {
		font-size: 18px;
		margin: 0 0 12px;
	}
	p {
		margin: 0;
		white-space: pre-wrap;
	}
`;

export const SellerBox = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 14px;
	border: 1px solid ${palette.border};
	border-radius: ${radius.md};

	a {
		text-decoration: none;
	}
	strong {
		display: block;
	}
	span {
		font-size: 13px;
		color: ${palette.muted};
	}
`;
