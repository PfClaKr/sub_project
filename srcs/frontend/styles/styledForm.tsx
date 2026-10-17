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
	/* Only the subtitle: FormFooter is a <p> too. */
	> h1 + p {
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

// Password field with a show/hide button on the right.
export const PasswordBox = styled.div`
	position: relative;

	input {
		padding-right: 44px;
	}
	button {
		position: absolute;
		right: 4px;
		top: 50%;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		padding: 0;
		border: none;
		background: none;
		color: ${palette.muted};
	}
	button:hover:not(:disabled) {
		background: none;
		color: ${palette.primary};
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

// Write pages: the form, and on wide screens a sticky column of tips.
export const WriteGrid = styled.div`
	display: grid;
	grid-template-columns: minmax(0, 680px) minmax(240px, 300px);
	justify-content: space-between;
	gap: 32px;
	align-items: start;

	@media (max-width: 900px) {
		grid-template-columns: minmax(0, 1fr);

		aside {
			display: none;
		}
	}
`;

export const TipsCard = styled.aside`
	position: sticky;
	top: 88px;
	padding: 20px;
	border-radius: ${radius.lg};
	background-color: ${palette.surface};

	h2 {
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0 0 12px;
		font-size: 16px;
		color: ${palette.heading};
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	li {
		display: flex;
		gap: 8px;
		font-size: 14px;
		line-height: 1.5;
		color: ${palette.text};
	}
	li svg {
		flex: none;
		margin-top: 3px;
		color: ${palette.primary};
	}
	.safety {
		margin-top: 16px;
		padding-top: 14px;
		border-top: 1px solid ${palette.border};
		font-size: 13px;
		color: ${palette.muted};
	}
	.safety a {
		color: ${palette.primary};
		font-weight: 600;
	}
`;
