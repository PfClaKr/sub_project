'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const DetailGrid = styled.div`
	display: grid;
	grid-template-columns: minmax(0, 480px) minmax(0, 1fr);
	gap: 32px;

	@media (max-width: 800px) {
		grid-template-columns: 1fr;
	}
`;

export const GalleryMain = styled.div`
	position: relative;
	width: 100%;
	aspect-ratio: 1 / 1;
	border-radius: 14px;
	overflow: hidden;
	background-color: ${palette.bg[100]};

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
`;

export const GalleryThumbs = styled.div`
	display: flex;
	gap: 8px;
	margin-top: 8px;
`;

export const GalleryThumb = styled.button<{ $active?: boolean }>`
	padding: 0;
	width: 64px;
	height: 64px;
	border-radius: 8px;
	overflow: hidden;
	background: none;
	border: 2px solid ${p => (p.$active ? palette.fg[300] : "transparent")};

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	&:hover {
		background: none;
	}
`;

export const InfoPanel = styled.div`
	display: flex;
	flex-direction: column;
	gap: 12px;
`;

export const DetailTitle = styled.h1`
	font-size: 24px;
	margin: 0;
`;

export const DetailPrice = styled.div`
	font-size: 28px;
	font-weight: 800;
	color: ${palette.fg[500]};
`;

export const MetaList = styled.ul`
	list-style: none;
	margin: 0;
	padding: 16px 0;
	border-top: 1px solid ${palette.line};
	border-bottom: 1px solid ${palette.line};
	display: flex;
	flex-direction: column;
	gap: 8px;
	font-size: 14px;
	color: ${palette.fg[100]};

	strong {
		color: ${palette.fg.default};
		font-weight: 600;
		display: inline-block;
		min-width: 72px;
	}
`;

export const ActionRow = styled.div`
	display: flex;
	gap: 10px;

	button {
		padding: 12px 20px;
		font-size: 15px;
	}

	@media (max-width: 600px) {
		button {
			flex: 1;
			padding: 12px 10px;
			font-size: 14px;
		}
	}
`;

export const SellerCard = styled.div`
	display: flex;
	align-items: center;
	gap: 14px;
	padding: 18px;
	border-radius: 14px;
	background-color: ${palette.bg[100]};
	border: 1px solid ${palette.line};
	margin-top: 28px;

	img {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		object-fit: cover;
	}
`;

export const SellerName = styled.div`
	font-weight: 700;
`;

export const SellerMeta = styled.div`
	font-size: 13px;
	color: ${palette.fg[100]};
`;

export const DescriptionSection = styled.section`
	margin-top: 32px;

	h2 {
		font-size: 18px;
	}

	p {
		white-space: pre-wrap;
		line-height: 1.7;
	}
`;
