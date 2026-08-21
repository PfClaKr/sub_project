'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const AuthWrap = styled.div`
	display: flex;
	justify-content: center;
	padding: 40px 0;
`;

export const AuthCard = styled.div`
	width: 100%;
	max-width: 420px;
	padding: 36px;
	border-radius: 16px;
	background-color: ${palette.bg.default};
	border: 1px solid ${palette.line};
	box-shadow: 0 10px 30px ${palette.shadow};

	form {
		max-width: none;
	}
`;

export const AuthTitle = styled.h1`
	font-size: 22px;
	margin: 0 0 4px;
`;

export const AuthSubtitle = styled.p`
	font-size: 14px;
	color: ${palette.fg[100]};
	margin: 0 0 20px;
`;

export const AuthFooter = styled.p`
	font-size: 14px;
	color: ${palette.fg[100]};
	margin: 20px 0 0;

	a {
		color: ${palette.fg[300]};
		font-weight: 600;
	}
`;
