'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const Nav = styled.nav`
	position: sticky;
	top: 0;
	z-index: 10;
	background-color: rgba(255, 255, 255, 0.92);
	backdrop-filter: blur(8px);
	border-bottom: 1px solid ${palette.line};
`;

export const NavInner = styled.ul`
	max-width: 1120px;
	margin: 0 auto;
	padding: 14px 16px;
	display: flex;
	align-items: center;
	gap: 18px;
	list-style: none;

	@media (max-width: 600px) {
		padding: 10px 12px;
		gap: 12px;
	}
`;

export const Brand = styled.li`
	font-size: 21px;
	font-weight: 800;
	letter-spacing: -0.03em;
	margin-right: 6px;

	a {
		color: ${palette.fg[500]};
	}

	@media (max-width: 600px) {
		font-size: 18px;
		margin-right: 0;
	}
`;

export const NavItem = styled.li`
	font-size: 15px;
	white-space: nowrap;

	@media (max-width: 600px) {
		font-size: 14px;
	}


	button {
		padding: 7px 14px;
		font-size: 13px;
		background-color: ${palette.bg[300]};
		color: ${palette.fg[500]};
	}

	button:hover {
		background-color: ${palette.bg[500]};
	}
`;

export const NavSpacer = styled.li`
	flex: 1;
`;

export const NavUser = styled.li`
	font-size: 14px;
	font-weight: 600;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 90px;

	@media (max-width: 600px) {
		max-width: 64px;
		font-size: 13px;
	}
`;

export const SellCta = styled(NavItem)`
	a {
		display: inline-block;
		padding: 7px 16px;
		white-space: nowrap;
		border-radius: 8px;
		background-color: ${palette.fg[500]};
		color: #ffffff !important;
		font-size: 14px;
		font-weight: 600;
	}

	a:hover {
		background-color: ${palette.fg[300]};
		color: #ffffff !important;
	}

	@media (max-width: 600px) {
		a {
			padding: 6px 12px;
			font-size: 13px;
		}
	}
`;
