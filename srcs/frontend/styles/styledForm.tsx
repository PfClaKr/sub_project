'use client';

import styled from "styled-components";
import palette, { radius } from "@/theme/colorPalette";

export const FormColumn = styled.form`
	display: flex;
	flex-direction: column;
	gap: 16px;
	width: 100%;
	max-width: 560px;
`;

export const AuthCard = styled.div`
	max-width: 420px;
	margin: 24px auto;
	padding: 28px 24px;
	border: 1px solid ${palette.border};
	border-radius: ${radius.lg};

	h1 {
		margin: 0 0 4px;
		font-size: 24px;
	}
	> p {
		margin: 0 0 20px;
		color: ${palette.muted};
	}
	form {
		max-width: none;
	}
`;

export const FieldLabel = styled.label`
	font-size: 14px;
	font-weight: 600;
	color: ${palette.heading};
	display: flex;
	flex-direction: column;
	gap: 6px;

	input, textarea, select {
		font-weight: 400;
	}
`;

export const Hint = styled.span`
	font-size: 12px;
	font-weight: 400;
	color: ${palette.muted};
`;

export const TwoColumns = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 16px;
`;

export const FormFooter = styled.p`
	margin: 16px 0 0;
	text-align: center;
	font-size: 14px;
	color: ${palette.muted};

	a {
		color: ${palette.primary};
		font-weight: 600;
	}
`;

// A titled card grouping related fields in long forms.
export const FormSection = styled.section`
	display: flex;
	flex-direction: column;
	gap: 14px;
	padding: 20px;
	border: 1px solid ${palette.border};
	border-radius: ${radius.lg};
	background: ${palette.bg};

	> header h2 {
		margin: 0;
		font-size: 17px;
	}
	> header p {
		margin: 2px 0 0;
		font-size: 13px;
		color: ${palette.muted};
	}

	@media (max-width: 600px) {
		padding: 16px;
	}
`;

// Input with a fixed prefix such as "€".
export const Adorned = styled.div`
	position: relative;

	span {
		position: absolute;
		left: 12px;
		top: 50%;
		transform: translateY(-50%);
		color: ${palette.muted};
		font-weight: 600;
		pointer-events: none;
	}
	input {
		padding-left: 30px;
	}
`;

export const Counter = styled.span`
	align-self: flex-end;
	font-size: 12px;
	font-weight: 400;
	color: ${palette.muted};
	font-variant-numeric: tabular-nums;
`;

export const SubmitButton = styled.button`
	width: 100%;
	padding: 14px;
	font-size: 16px;
	border-radius: ${radius.md};
`;
