'use client';

import Link from "next/link";
import styled from "styled-components";
import palette, { radius } from "@/theme/colorPalette";

export const LegalArticle = styled.article`
	max-width: 780px;
	line-height: 1.75;
	color: ${palette.text};

	h1 {
		margin: 0 0 6px;
		font-size: 28px;
	}
	h2 {
		margin: 36px 0 10px;
		font-size: 19px;
		color: ${palette.heading};
		scroll-margin-top: 80px;
	}
	h3 {
		margin: 20px 0 6px;
		font-size: 16px;
	}
	p, li {
		font-size: 15px;
	}
	ol, ul {
		padding-left: 22px;
	}
	li + li {
		margin-top: 4px;
	}
	a {
		color: ${palette.primary};
	}
	.updated {
		color: ${palette.muted};
		font-size: 14px;
	}
	.table-wrap {
		overflow-x: auto;
		margin: 10px 0;
	}
	table {
		width: 100%;
		min-width: 560px;
		border-collapse: collapse;
		font-size: 14px;
		line-height: 1.55;
	}
	th, td {
		padding: 8px 10px;
		border: 1px solid ${palette.border};
		text-align: left;
		vertical-align: top;
	}
	th {
		background-color: ${palette.surface};
		font-weight: 700;
	}
	address {
		font-style: normal;
	}
`;

export const LegalNav = styled.nav`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px 16px;
	margin: 0 0 24px;
	padding-bottom: 14px;
	border-bottom: 1px solid ${palette.border};
	font-size: 14px;

	.docs {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
	}
	.docs a {
		color: ${palette.muted};
		text-decoration: none;
		font-weight: 600;
	}
	.docs a[aria-current="page"] {
		color: ${palette.primary};
	}
	.langs {
		margin-left: auto;
		display: inline-flex;
		border: 1px solid ${palette.border};
		border-radius: 999px;
		overflow: hidden;
	}
`;

// && raises specificity above LegalArticle's link color.
export const LangLink = styled(Link)<{ $on: boolean }>`
	&& {
		padding: 5px 14px;
		font-weight: 600;
		text-decoration: none;
		color: ${p => (p.$on ? "#fff" : palette.text)};
		background-color: ${p => (p.$on ? palette.primary : "transparent")};
	}
`;

// An operator detail still to fill in (libs/legal.ts).
export const Missing = styled.mark`
	padding: 1px 6px;
	border-radius: ${radius.sm};
	background-color: ${palette.warningSoft};
	color: ${palette.warning};
	font-weight: 700;
`;
