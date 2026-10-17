'use client';

import styled from "styled-components";
import palette, { radius } from "@/theme/colorPalette";

export const ChatHeader = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px;
	border: 1px solid ${palette.border};
	border-bottom: none;
	border-radius: ${radius.md} ${radius.md} 0 0;

	img, > div:first-child {
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: ${radius.sm};
		object-fit: cover;
		background-color: ${palette.surface};
	}
	a {
		text-decoration: none;
		font-weight: 700;
	}
	small {
		display: block;
		color: ${palette.muted};
	}
`;

export const ConnectionDot = styled.span<{ $on: boolean }>`
	margin-left: auto;
	font-size: 12px;
	color: ${p => (p.$on ? "#1e8e3e" : palette.muted)};

	&::before {
		content: "●";
		margin-right: 4px;
	}
`;

export const MessageList = styled.div`
	display: flex;
	flex-direction: column;
	gap: 6px;
	height: min(60vh, 520px);
	overflow-y: auto;
	padding: 16px;
	border: 1px solid ${palette.border};
	background-color: ${palette.surface};
`;

export const BubbleRow = styled.div<{ $mine?: boolean }>`
	display: flex;
	flex-direction: ${p => (p.$mine ? "row-reverse" : "row")};
	align-items: flex-end;
	gap: 6px;
`;

export const Bubble = styled.div<{ $mine?: boolean }>`
	max-width: 75%;
	padding: 8px 12px;
	border-radius: 14px;
	font-size: 14px;
	white-space: pre-wrap;
	background-color: ${p => (p.$mine ? palette.primary : palette.bg)};
	color: ${p => (p.$mine ? "#ffffff" : palette.text)};
	border: 1px solid ${p => (p.$mine ? palette.primary : palette.border)};
`;

export const BubbleTime = styled.time`
	flex: none;
	font-size: 11px;
	color: ${palette.muted};
`;

export const ChatInputRow = styled.form`
	display: flex;
	gap: 8px;
	padding: 12px;
	border: 1px solid ${palette.border};
	border-top: none;
	border-radius: 0 0 ${radius.md} ${radius.md};

	input {
		flex: 1;
		min-width: 0;
	}
`;

export const RoomList = styled.ul`
	margin: 0;
	padding: 0;
	list-style: none;
	border: 1px solid ${palette.border};
	border-radius: ${radius.md};
	overflow: hidden;

	li + li {
		border-top: 1px solid ${palette.border};
	}
	a {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		text-decoration: none;
	}
	a:hover {
		background-color: ${palette.surface};
	}
	img, .thumb {
		flex: none;
		width: 56px;
		height: 56px;
		border-radius: ${radius.sm};
		object-fit: cover;
		background-color: ${palette.surface};
	}
	strong {
		display: block;
	}
	small {
		color: ${palette.muted};
	}
`;

export const DayDivider = styled.p`
	margin: 8px 0;
	text-align: center;
	font-size: 12px;
	color: ${palette.muted};
`;

export const EmptyHint = styled.p`
	margin: auto;
	color: ${palette.muted};
`;

// The ⋯ menu in the chat header (report, block).
export const MenuWrap = styled.div`
	position: relative;
	flex: none;
`;

export const MenuToggle = styled.button`
	display: grid;
	place-items: center;
	width: 36px;
	height: 36px;
	padding: 0;
	border: none;
	border-radius: 50%;
	background: none;
	color: ${palette.muted};

	&:hover:not(:disabled) {
		background-color: ${palette.surface};
		color: ${palette.text};
	}
`;

export const MenuPanel = styled.div`
	position: absolute;
	right: 0;
	top: calc(100% + 4px);
	z-index: 20;
	min-width: 160px;
	padding: 6px;
	border: 1px solid ${palette.border};
	border-radius: ${radius.md};
	background-color: ${palette.bg};
	box-shadow: 0 8px 24px rgba(16, 23, 80, 0.14);

	button {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 8px;
		width: 100%;
		padding: 9px 10px;
		border: none;
		border-radius: ${radius.sm};
		background: none;
		color: ${palette.text};
		font-size: 14px;
		font-weight: 500;
		text-align: left;
	}
	button:hover:not(:disabled) {
		background-color: ${palette.surface};
	}
	button.danger {
		color: ${palette.danger};
	}
`;

// Shown instead of the input when either side blocked the other.
export const BlockedBar = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
	gap: 10px;
	min-height: 70px;
	padding: 10px 12px;
	border: 1px solid ${palette.border};
	border-top: none;
	border-radius: 0 0 ${radius.md} ${radius.md};
	background-color: ${palette.surface};
	color: ${palette.muted};
	font-size: 14px;
`;
