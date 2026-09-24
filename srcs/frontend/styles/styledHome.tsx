'use client';

import styled from "styled-components";
import palette, { radius, breakpoint } from "@/theme/colorPalette";

export const Hero = styled.section`
	text-align: center;
	padding: 44px 16px 36px;
	background: linear-gradient(180deg, ${palette.primarySoft}, ${palette.surface});
	border-radius: ${radius.lg};
	margin-bottom: 28px;

	h1 {
		margin: 8px 0 20px;
		font-size: 28px;
	}

	@media (max-width: ${breakpoint.sm}) {
		padding: 32px 16px 28px;
		h1 {
			font-size: 22px;
		}
	}
`;

export const HeroTag = styled.p`
	margin: 0;
	color: ${palette.primary};
	font-weight: 700;
`;

export const SearchRow = styled.form`
	display: flex;
	gap: 8px;
	width: 100%;
	max-width: 520px;
	margin: 0 auto;

	input {
		flex: 1;
		min-width: 0;
	}
	button {
		flex: none;
	}
`;

export const ComboBox = styled.div`
	position: relative;
	flex: 1;
	min-width: 0;

	input {
		width: 100%;
	}
`;

export const SuggestionList = styled.ul`
	position: absolute;
	z-index: 20;
	top: calc(100% + 4px);
	left: 0;
	right: 0;
	margin: 0;
	padding: 4px 0;
	list-style: none;
	text-align: left;
	background-color: ${palette.bg};
	border: 1px solid ${palette.border};
	border-radius: ${radius.md};
	box-shadow: 0 8px 24px rgba(16, 23, 80, 0.12);

	li {
		padding: 9px 14px;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	li[aria-selected="true"], li:hover {
		background-color: ${palette.primarySoft};
	}
	mark {
		background: none;
		color: ${palette.primary};
		font-weight: 700;
	}
`;
