'use client';

import styled from "styled-components";
import palette, { breakpoint } from "@/theme/colorPalette";

export const Nav = styled.nav`
	position: sticky;
	top: 0;
	z-index: 10;
	background-color: rgba(255, 255, 255, 0.95);
	backdrop-filter: blur(6px);
	border-bottom: 1px solid ${palette.border};
	padding-top: env(safe-area-inset-top);
`;

export const NavInner = styled.div`
	max-width: 1120px;
	margin: 0 auto;
	padding: 12px 16px;
	display: flex;
	align-items: center;
	gap: 16px;

	@media (max-width: ${breakpoint.sm}) {
		flex-wrap: wrap;
		row-gap: 8px;
	}
`;

export const Brand = styled.div`
	font-size: 20px;
	font-weight: 800;

	a {
		color: ${palette.primary};
	}
`;

// Scrolls horizontally on narrow screens instead of wrapping.
export const NavLinks = styled.ul`
	display: flex;
	gap: 18px;
	margin: 0;
	padding: 0;
	list-style: none;
	font-size: 15px;
	overflow-x: auto;
	white-space: nowrap;
	scrollbar-width: none;

	@media (max-width: ${breakpoint.sm}) {
		order: 3;
		width: 100%;
	}
`;

export const NavSpacer = styled.div`
	flex: 1;
`;

export const NavUser = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
	font-size: 14px;

	button {
		padding: 6px 12px;
	}
`;

// Section tabs (중고 · 커뮤니티 · 집 · 알바). On phones they move to the
// bottom tab bar, so the header keeps only brand and icons.
export const SectionTabs = styled(NavLinks)`
	@media (max-width: ${breakpoint.sm}) {
		display: none;
	}
`;

export const IconLink = styled.a`
	position: relative;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: 50%;
	color: ${palette.text};

	&:hover,
	&[aria-current="page"] {
		color: ${palette.primary};
		background-color: ${palette.primarySoft};
	}
`;

export const Badge = styled.span`
	position: absolute;
	top: 2px;
	right: 0;
	min-width: 16px;
	height: 16px;
	padding: 0 4px;
	border-radius: 8px;
	background-color: ${palette.danger};
	color: #fff;
	font-size: 10px;
	font-weight: 700;
	line-height: 16px;
	text-align: center;
`;

// Hidden on phones, where the bottom bar and the avatar cover it.
export const DesktopOnly = styled.div`
	display: contents;

	@media (max-width: ${breakpoint.sm}) {
		display: none;
	}
`;

export const MobileOnly = styled.div`
	display: none;

	@media (max-width: ${breakpoint.sm}) {
		display: contents;
	}
`;

export const BottomBar = styled.nav`
	display: none;

	@media (max-width: ${breakpoint.sm}) {
		display: flex;
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 10;
		background-color: rgba(255, 255, 255, 0.97);
		backdrop-filter: blur(6px);
		border-top: 1px solid ${palette.border};
		padding-bottom: env(safe-area-inset-bottom);
	}
`;

export const BottomTab = styled.a<{ $active: boolean }>`
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
	padding: 8px 0 6px;
	font-size: 11px;
	font-weight: ${p => (p.$active ? 700 : 500)};
	color: ${p => (p.$active ? palette.primary : palette.muted)};
	text-decoration: none;
`;

// Keeps the footer clear of the fixed bottom bar on phones.
export const BottomSpacer = styled.div`
	display: none;

	@media (max-width: ${breakpoint.sm}) {
		display: block;
		height: calc(56px + env(safe-area-inset-bottom));
	}
`;
