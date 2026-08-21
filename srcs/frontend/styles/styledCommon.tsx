'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const PageTitle = styled.h1`
	font-size: 26px;
	margin: 8px 0 22px;
`;

export const Breadcrumb = styled.p`
	font-size: 13px;
	color: ${palette.fg[100]};
	margin: 0 0 16px;
`;

export const EmptyState = styled.div`
	padding: 64px 16px;
	text-align: center;
	color: ${palette.fg[100]};
	background-color: ${palette.bg[100]};
	border: 1px solid ${palette.line};
	border-radius: 14px;
	line-height: 1.8;
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
	border: 1px solid ${palette.line};
	border-radius: 14px;
	padding: 28px;
`;
