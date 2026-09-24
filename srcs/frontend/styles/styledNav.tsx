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
