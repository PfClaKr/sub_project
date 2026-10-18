'use client';

import styled from "styled-components";
import palette, { radius } from "@/theme/colorPalette";

export const NoticeList = styled.ul`
	margin: 0;
	padding: 0;
	list-style: none;
	border: 1px solid ${palette.border};
	border-radius: ${radius.md};
	overflow: hidden;

	li + li {
		border-top: 1px solid ${palette.border};
	}
`;

export const NoticeItem = styled.a<{ $unread: boolean }>`
	display: flex;
	gap: 12px;
	padding: 14px;
	text-decoration: none;
	color: ${palette.text};
	background-color: ${p => (p.$unread ? palette.primarySoft : palette.bg)};

	&:hover {
		background-color: ${palette.surface};
	}
	svg {
		flex: none;
		margin-top: 2px;
		color: ${p => (p.$unread ? palette.primary : palette.muted)};
	}
	strong {
		display: block;
		font-weight: ${p => (p.$unread ? 700 : 500)};
	}
	p {
		margin: 4px 0 0;
		color: ${palette.muted};
		font-size: 14px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	small {
		display: block;
		margin-top: 4px;
		color: ${palette.muted};
		font-size: 12px;
	}
	div {
		min-width: 0;
	}
`;

export const ListActions = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin-bottom: 12px;
	font-size: 14px;
	color: ${palette.muted};

	strong {
		color: ${palette.primary};
	}
	button {
		padding: 6px 12px;
	}
`;


export const SuspendedBar = styled.div`
	padding: 10px 16px;
	text-align: center;
	font-size: 14px;
	color: ${palette.danger};
	background-color: ${palette.dangerSoft};
`;

export const SettingsTable = styled.table`
	width: 100%;
	border-collapse: collapse;
	font-size: 14px;

	th {
		text-align: left;
		font-size: 12px;
		color: ${palette.muted};
		padding: 8px;
		border-bottom: 1px solid ${palette.border};
	}
	td {
		padding: 8px;
		border-bottom: 1px solid ${palette.border};
	}
	select {
		width: auto;
		min-width: 130px;
	}
	input[type="checkbox"] {
		width: 18px;
		height: 18px;
	}
`;
