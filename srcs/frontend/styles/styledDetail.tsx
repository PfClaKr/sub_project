'use client';

import styled from "styled-components";
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
