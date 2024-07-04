import AppTheme from "@/theme/ui";
import styled from "styled-components";
import Link from "next/link"

export const StyledLink = styled(Link)`
	text-decoration: none;
	&:focus, &:hover, &:visited, &:link, &:active {
		text-decoration: none;
	}
`;

export const StyledNavbar = styled(StyledLink)`
	color: ${AppTheme.app.color.default};
	&:hover {
		color: ${AppTheme.app.color.primary};
	}
`;
