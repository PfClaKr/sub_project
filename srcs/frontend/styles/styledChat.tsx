'use client';

import styled from "styled-components";
import palette from "@/theme/colorPalette";

export const RoomList = styled.ul`
	list-style: none;
	margin: 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: 10px;
`;

export const RoomCard = styled.li`
	border: 1px solid ${palette.bg[300]};
	border-radius: 12px;
	background-color: ${palette.bg[100]};
	transition: background-color 0.15s ease;

	&:hover {
		background-color: ${palette.bg[300]};
	}

	a {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
	}

	img {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		object-fit: cover;
		background-color: ${palette.bg[300]};
	}
`;

export const RoomTitle = styled.div`
	font-weight: 600;
	color: ${palette.fg.default};
`;

export const RoomMeta = styled.div`
	font-size: 13px;
	color: ${palette.fg[100]};
`;

export const MessageList = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
	height: 420px;
	overflow-y: auto;
	padding: 16px;
	border: 1px solid ${palette.bg[500]};
	border-radius: 8px;
	background-color: ${palette.bg[100]};
`;

export const Bubble = styled.div<{ $mine?: boolean }>`
	max-width: 70%;
	padding: 8px 12px;
	border-radius: 12px;
	font-size: 14px;
	align-self: ${p => (p.$mine ? "flex-end" : "flex-start")};
	background-color: ${p => (p.$mine ? palette.fg[500] : palette.bg[300])};
	color: ${p => (p.$mine ? "#ffffff" : palette.fg.default)};
`;

export const BubbleMeta = styled.div`
	font-size: 11px;
	color: ${palette.fg[100]};
	margin-bottom: 2px;
`;

export const ChatInputRow = styled.form`
	display: flex;
	gap: 8px;
	margin-top: 12px;

	input {
		flex: 1;
	}
`;
