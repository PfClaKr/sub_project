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
	justify-content: flex-end;
	margin-bottom: 12px;
`;

export const ComingSoonBox = styled.section`
	padding: 40px 24px;
	text-align: center;
	background-color: ${palette.surface};
	border-radius: ${radius.lg};

	svg {
		color: ${palette.primary};
	}
	h2 {
		margin: 12px 0 8px;
		color: ${palette.heading};
	}
	p {
		margin: 0 auto;
		max-width: 460px;
		color: ${palette.muted};
		line-height: 1.6;
	}
	ul {
		display: inline-block;
		margin: 16px 0 0;
		padding-left: 20px;
		text-align: left;
		color: ${palette.text};
		line-height: 1.8;
	}
`;

export const SuspendedBar = styled.div`
	padding: 10px 16px;
	text-align: center;
	font-size: 14px;
	color: ${palette.danger};
	background-color: ${palette.dangerSoft};
`;
