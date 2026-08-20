'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const Nav = styled.nav`
	position: sticky;
	top: 0;
	z-index: 10;
	background-color: ${palette.bg.default};
	border-bottom: 1px solid ${palette.bg[500]};
`;

export const NavInner = styled.ul`
	max-width: 1120px;
	margin: 0 auto;
	padding: 14px 16px;
	display: flex;
	align-items: center;
	gap: 20px;
	list-style: none;
`;

export const Brand = styled.li`
	font-size: 20px;
	font-weight: 800;
	color: ${palette.fg[500]};
	margin-right: 8px;
`;

export const NavItem = styled.li`
	font-size: 15px;
`;

export const NavSpacer = styled.li`
	flex: 1;
`;

export const NavUser = styled.li`
	font-size: 14px;
	color: ${palette.fg[100]};
`;
