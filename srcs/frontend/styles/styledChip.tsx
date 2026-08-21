'use client';

import styled from "styled-components";
import Link from "next/link";
import palette from "@/theme/colorPalette";

export const KeywordChip = styled(Link)`
	display: inline-block;
	padding: 6px 14px;
	border-radius: 16px;
	font-size: 14px;
	text-decoration: none;
	color: ${palette.fg[500]};
	background-color: ${palette.bg[300]};

	&:hover {
		background-color: ${palette.bg[500]};
	}
`;
