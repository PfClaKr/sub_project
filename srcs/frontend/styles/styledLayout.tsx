'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const Main = styled.main`
	max-width: 1120px;
	min-height: calc(100vh - 160px);
	margin: 0 auto;
	padding: 24px max(16px, env(safe-area-inset-right)) calc(64px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
`;

export const PageHeader = styled.header`
	margin: 8px 0 24px;

	h1 {
		margin: 0;
		font-size: 26px;
	}
	p {
		margin: 6px 0 0;
		color: ${palette.muted};
	}
`;

export const Section = styled.section`
	margin-top: 32px;
`;

export const SectionTitle = styled.h2`
	font-size: 19px;
	margin: 0 0 14px;
`;

export const Row = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
`;

export const FooterBar = styled.footer`
	border-top: 1px solid ${palette.border};
	padding: 24px 16px;
	text-align: center;
	font-size: 13px;
	color: ${palette.muted};

	p {
		margin: 2px 0;
	}
`;
