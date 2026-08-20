'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const Hero = styled.section`
	text-align: center;
	padding: 48px 16px 40px;
	background-color: ${palette.bg[100]};
	border-radius: 12px;
	margin-bottom: 32px;

	h1 {
		margin: 8px 0 20px;
	}
`;

export const HeroTag = styled.p`
	margin: 0;
	color: ${palette.fg[300]};
	font-weight: 700;
`;

export const SearchRow = styled.div`
	display: inline-flex;
	gap: 8px;

	input {
		min-width: 280px;
	}
`;

export const SectionTitle = styled.p`
	font-size: 18px;
	font-weight: 700;
	color: ${palette.fg[700]};
	margin: 24px 0 8px;
`;
