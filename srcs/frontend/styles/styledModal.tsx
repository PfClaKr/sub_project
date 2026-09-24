'use client';

import styled, { keyframes } from "styled-components";
import palette, { radius, breakpoint } from "@/theme/colorPalette";

const fade = keyframes`
	from { opacity: 0; }
	to { opacity: 1; }
`;
const rise = keyframes`
	from { opacity: 0; transform: translateY(12px) scale(0.98); }
	to { opacity: 1; transform: none; }
`;

export const Backdrop = styled.div`
	position: fixed;
	inset: 0;
	z-index: 1000;
	display: grid;
	place-items: center;
	padding: 16px;
	background: rgba(16, 23, 80, 0.35);
	backdrop-filter: blur(3px);
	animation: ${fade} 0.15s ease-out;

	@media (max-width: ${breakpoint.sm}) {
		place-items: end stretch;
		padding: 0;
	}
`;

export const Dialog = styled.div`
	width: 100%;
	max-width: 400px;
	padding: 24px;
	border-radius: ${radius.lg};
	background: ${palette.bg};
	box-shadow: 0 20px 50px rgba(16, 23, 80, 0.25);
	animation: ${rise} 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);

	h2 {
		margin: 12px 0 6px;
		font-size: 19px;
	}
	p {
		margin: 0;
		color: ${palette.muted};
		font-size: 15px;
		white-space: pre-line;
	}

	@media (max-width: ${breakpoint.sm}) {
		max-width: none;
		border-radius: ${radius.lg} ${radius.lg} 0 0;
		padding-bottom: calc(24px + env(safe-area-inset-bottom));
	}
`;

export const DialogIcon = styled.span<{ $danger?: boolean }>`
	display: grid;
	place-items: center;
	width: 44px;
	height: 44px;
	border-radius: 50%;
	color: ${p => (p.$danger ? palette.danger : palette.primary)};
	background: ${p => (p.$danger ? palette.dangerSoft : palette.primarySoft)};
`;

export const DialogField = styled.label`
	display: grid;
	gap: 6px;
	margin-top: 16px;
	font-size: 13px;
	font-weight: 600;
	color: ${palette.heading};

	code {
		font-family: inherit;
		color: ${palette.danger};
	}
`;

export const DialogActions = styled.div`
	display: flex;
	justify-content: flex-end;
	gap: 8px;
	margin-top: 22px;

	button {
		min-width: 88px;
	}

	@media (max-width: ${breakpoint.sm}) {
		button {
			flex: 1;
			padding: 12px;
		}
	}
`;

export const DangerSolid = styled.button`
	background-color: ${palette.danger};

	&:hover:not(:disabled) {
		background-color: #a93226;
	}
`;
