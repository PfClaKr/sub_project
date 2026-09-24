'use client';

import Link from "next/link";
import styled from "styled-components";
import palette, { radius, breakpoint } from "@/theme/colorPalette";

export const AdminShell = styled.div`
	display: flex;
	gap: 28px;
	align-items: flex-start;

	> div {
		flex: 1;
		min-width: 0;
	}

	@media (max-width: ${breakpoint.md}) {
		flex-direction: column;
		/* flex-start would size the content to the table's min-width
		   and make phones zoom the whole page out. */
		align-items: stretch;
		gap: 16px;
	}
`;

export const SideNav = styled.nav`
	flex: none;
	width: 200px;
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding-right: 20px;
	border-right: 1px solid ${palette.border};

	a {
		padding: 9px 14px;
		border-radius: ${radius.sm};
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
	}
	a:hover {
		background: ${palette.primarySoft};
	}
	a[aria-current="page"] {
		background: ${palette.primary};
		color: #ffffff;
	}

	@media (max-width: ${breakpoint.md}) {
		width: 100%;
		flex-direction: row;
		overflow-x: auto;
		padding: 0 0 12px;
		border-right: none;
		border-bottom: 1px solid ${palette.border};

		a {
			border-radius: 999px;
		}
	}
`;

export const Panel = styled.section`
	padding: 22px;
	border: 1px solid ${palette.border};
	border-radius: ${radius.lg};
	background: ${palette.bg};

	h2 {
		margin: 0 0 4px;
		font-size: 22px;
	}

	@media (max-width: ${breakpoint.sm}) {
		padding: 14px;
	}
`;

export const StatGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
	gap: 14px;
	margin-top: 16px;
`;

export const StatTile = styled(Link)`
	display: block;
	padding: 18px;
	border: 1px solid ${palette.border};
	border-radius: ${radius.md};
	text-decoration: none;
	transition: border-color 0.15s, transform 0.15s;

	span {
		font-size: 13px;
		font-weight: 600;
		color: ${palette.muted};
	}
	strong {
		display: block;
		margin-top: 6px;
		font-size: 30px;
		font-weight: 800;
		color: ${palette.primary};
	}
	small {
		color: ${palette.muted};
	}
	&:hover {
		border-color: ${palette.primary};
		transform: translateY(-2px);
	}
	&:hover span {
		color: ${palette.primary};
	}
`;

export const FilterForm = styled.form`
	display: flex;
	flex-wrap: wrap;
	align-items: flex-end;
	gap: 8px;
	margin: 16px 0;

	label {
		display: grid;
		gap: 4px;
		font-size: 12px;
		font-weight: 700;
		color: ${palette.muted};
	}
	input {
		width: 240px;
		max-width: 100%;
	}
	select {
		width: auto;
	}
	input, select {
		height: 40px;
		padding: 0 10px;
	}
	button {
		height: 40px;
	}
`;

export const TableWrap = styled.div`
	overflow-x: auto;
	border: 1px solid ${palette.border};
	border-radius: ${radius.md};
`;

export const Table = styled.table`
	width: 100%;
	min-width: 760px;
	border-collapse: collapse;
	font-size: 14px;

	th {
		text-align: left;
		padding: 10px 12px;
		font-size: 12px;
		color: ${palette.muted};
		background: ${palette.surface};
		border-bottom: 1px solid ${palette.border};
		white-space: nowrap;
	}
	td {
		padding: 10px 12px;
		border-bottom: 1px solid ${palette.border};
		vertical-align: middle;
	}
	tr:last-child td {
		border-bottom: none;
	}
	tbody tr:hover {
		background: ${palette.surface};
	}
	select {
		width: auto;
		padding: 5px 8px;
	}
	a {
		text-decoration: none;
		font-weight: 600;
	}
	a:hover {
		color: ${palette.primary};
	}
`;

export const Thumb = styled.img`
	width: 44px;
	height: 44px;
	border-radius: ${radius.sm};
	object-fit: cover;
	background: ${palette.surface};
`;

export const Who = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;

	small {
		display: block;
		color: ${palette.muted};
		font-weight: 400;
	}
`;

export const RoleBadge = styled.span<{ $admin?: boolean }>`
	display: inline-block;
	padding: 2px 8px;
	border-radius: 999px;
	font-size: 12px;
	font-weight: 700;
	color: ${p => (p.$admin ? "#ffffff" : palette.muted)};
	background: ${p => (p.$admin ? palette.heading : palette.surface)};
`;

export const Note = styled.p`
	margin: 12px 0;
	padding: 12px 14px;
	border-radius: ${radius.md};
	background: ${palette.warningSoft};
	color: ${palette.warning};
	font-size: 14px;
`;

export const Transcript = styled.ol`
	list-style: none;
	margin: 16px 0 0;
	padding: 0;
	display: grid;
	gap: 10px;

	li {
		padding: 12px 14px;
		border: 1px solid ${palette.border};
		border-radius: ${radius.md};
	}
	li[data-side="buyer"] {
		background: ${palette.surface};
	}
	header {
		display: flex;
		justify-content: space-between;
		gap: 8px;
		font-size: 13px;
		margin-bottom: 4px;
	}
	time {
		color: ${palette.muted};
	}
	p {
		margin: 0;
		white-space: pre-wrap;
	}
`;

export const EmptyRow = styled.p`
	padding: 32px 0;
	text-align: center;
	color: ${palette.muted};
`;
