'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const Hero = styled.section`
	text-align: center;
	padding: 64px 16px 56px;
	background: linear-gradient(160deg, ${palette.bg[300]} 0%, ${palette.bg[100]} 100%);
	border-radius: 16px;
	margin-bottom: 40px;

	h1 {
		margin: 8px 0 24px;
		font-size: 32px;

		@media (max-width: 600px) {
			font-size: 24px;
		}
	}
`;

export const HeroTag = styled.p`
	margin: 0;
	color: ${palette.fg[500]};
	font-weight: 700;
	font-size: 14px;
	letter-spacing: 0.04em;
`;

export const SearchRow = styled.div`
	display: inline-flex;
	gap: 8px;
	width: 100%;
	max-width: 460px;

	input {
		flex: 1;
		min-width: 0;
		padding: 12px 16px;
		box-shadow: 0 2px 10px ${palette.shadow};
	}

	button {
		padding: 12px 22px;
	}
`;

export const SectionTitle = styled.p`
	font-size: 19px;
	font-weight: 700;
	color: ${palette.fg[700]};
	margin: 32px 0 12px;
`;
