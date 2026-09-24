'use client';

import styled from "styled-components";
import Link from "next/link";
import palette from "@/theme/colorPalette";

export const StyledLink = styled(Link)`
	text-decoration: none;
	color: inherit;
`;

export const StyledNavbar = styled(StyledLink)<{ $active?: boolean }>`
	color: ${p => (p.$active ? palette.primary : palette.text)};
	font-weight: ${p => (p.$active ? 700 : 500)};

	&:hover {
		color: ${palette.primary};
	}
`;
