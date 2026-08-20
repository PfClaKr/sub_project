'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const FormColumn = styled.form`
	display: flex;
	flex-direction: column;
	gap: 12px;
	max-width: 420px;
`;

export const FieldLabel = styled.label`
	font-size: 14px;
	font-weight: 600;
	color: ${palette.fg[700]};
	display: flex;
	flex-direction: column;
	gap: 6px;
`;

export const ErrorText = styled.p`
	color: #c0392b;
	font-size: 14px;
	margin: 0;
`;
