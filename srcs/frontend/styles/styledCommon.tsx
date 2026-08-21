'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const PageTitle = styled.h1`
	font-size: 24px;
	margin: 8px 0 20px;
`;

export const Breadcrumb = styled.p`
	font-size: 13px;
	color: ${palette.fg[100]};
	margin: 0 0 16px;
`;

export const EmptyState = styled.div`
	padding: 56px 16px;
	text-align: center;
	color: ${palette.fg[100]};
	background-color: ${palette.bg[100]};
	border-radius: 12px;
`;

export const ChipRow = styled.div`
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 8px;
	margin-top: 16px;
`;

export const SectionCard = styled.section`
	background-color: ${palette.bg[100]};
	border-radius: 12px;
	padding: 24px;
`;
