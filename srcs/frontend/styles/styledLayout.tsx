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

export const FooterLinks = styled.nav`
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 6px 18px;
	margin-bottom: 12px;

	a {
		color: ${palette.text};
		font-weight: 600;
		text-decoration: none;
	}
	a:hover {
		color: ${palette.primary};
	}
	/* Finger-sized targets without changing the look. */
	@media (pointer: coarse) {
		gap: 0 8px;

		a {
			padding: 8px 6px;
		}
	}
`;

export const FooterLegal = styled.nav`
	display: flex;
	flex-wrap: wrap;
	justify-content: center;
	gap: 4px 14px;
	margin-bottom: 8px;
	font-size: 12px;

	a {
		color: ${palette.muted};
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
	@media (pointer: coarse) {
		gap: 0 6px;

		a {
			padding: 6px 4px;
		}
	}
`;

// The language menu in the footer.
export const LanguageSelect = styled.label`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	margin-top: 12px;
	color: ${palette.muted};

	select {
		width: auto;
		padding: 5px 30px 5px 10px;
		font-size: 13px;
		background-position: right 10px center;
	}
`;

// The site-wide notice under the header (NoticeBanner).
export const NoticeBar = styled.div<{ $tone: "info" | "warning" }>`
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 16px;
	font-size: 14px;
	color: ${p => (p.$tone === "warning" ? palette.warning : palette.primary)};
	background-color: ${p => (p.$tone === "warning" ? palette.warningSoft : palette.primarySoft)};

	span {
		flex: 1;
		max-width: 1088px;
		margin: 0 auto;
	}
	a {
		color: inherit;
		font-weight: 700;
	}
	button,
	button:hover:not(:disabled) {
		padding: 4px;
		border: none;
		background: none;
		color: inherit;
	}
`;

// Shown while an admin previews unsaved site changes (PreviewBar).
export const PreviewRibbon = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
	gap: 8px 12px;
	padding: calc(10px + env(safe-area-inset-top)) 16px 10px;
	font-size: 14px;
	color: #fff;
	background: ${palette.heading};

	button,
	button:hover:not(:disabled) {
		padding: 6px 12px;
		font-size: 13px;
		color: ${palette.heading};
		background: #fff;
		border: none;
	}
`;
