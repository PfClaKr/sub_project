'use client';

import styled from "styled-components";
import palette, { radius, breakpoint } from "@/theme/colorPalette";

export const Toolbar = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 10px;
	margin-bottom: 18px;

	select {
		width: auto;
		padding: 8px 12px;
		font-weight: 600;
	}
`;

export const FilterButton = styled.button<{ $on?: boolean }>`
	background: ${p => (p.$on ? palette.primarySoft : palette.bg)};
	color: ${palette.primary};
	border: 1px solid ${p => (p.$on ? palette.primary : palette.border)};
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;

	&:hover:not(:disabled) {
		background: ${palette.primarySoft};
	}
`;

export const Popover = styled.div`
	position: relative;
`;

export const PopoverPanel = styled.div`
	position: absolute;
	z-index: 40;
	top: calc(100% + 6px);
	/* The trigger sits at the right end of the toolbar. */
	right: 0;
	width: min(420px, calc(100vw - 32px));
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 12px;
	background: ${palette.bg};
	border: 1px solid ${palette.border};
	border-radius: ${radius.lg};
	box-shadow: 0 12px 32px rgba(16, 23, 80, 0.16);

	@media (max-width: ${breakpoint.sm}) {
		position: fixed;
		top: auto;
		bottom: 0;
		left: 0;
		right: 0;
		width: 100%;
		max-height: 85vh;
		overflow-y: auto;
		border-radius: ${radius.lg} ${radius.lg} 0 0;
	}
`;

export const PanelActions = styled.div`
	display: flex;
	justify-content: space-between;
	gap: 8px;
`;
