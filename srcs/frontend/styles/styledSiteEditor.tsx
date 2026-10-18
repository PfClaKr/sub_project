'use client';

import styled from "styled-components";
import palette, { radius } from "@/theme/colorPalette";

// /admin/site (components/admin/SiteEditor.tsx).
export const EditorGrid = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: flex-end;
	gap: 10px;
	margin-bottom: 12px;

	label {
		display: grid;
		gap: 4px;
		font-size: 12px;
		font-weight: 700;
		color: ${palette.muted};
	}
	label.check {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: ${palette.text};
	}
	label.check input {
		width: auto;
	}
	select {
		width: auto;
		min-width: 120px;
	}
`;

export const TextRow = styled.div<{ $changed: boolean }>`
	display: grid;
	gap: 6px;
	padding: 12px;
	margin-bottom: 8px;
	border: 1px solid ${p => (p.$changed ? palette.primary : palette.border)};
	border-radius: ${radius.md};
	background: ${p => (p.$changed ? palette.primarySoft : palette.bg)};

	.ko {
		margin: 0;
		font-size: 13px;
	}
	textarea {
		resize: vertical;
		font-size: 14px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
	}
	.builtin {
		flex: 1;
		font-size: 12px;
	}
	.actions button {
		padding: 6px 12px;
		font-size: 13px;
	}
`;

export const KeyCell = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;

	code {
		font-size: 12px;
		color: ${palette.muted};
		overflow-wrap: anywhere;
	}
	.badge {
		padding: 1px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
		color: #ffffff;
		background: ${palette.primary};
	}
`;

export const SectionRow = styled.li`
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	margin-bottom: 6px;
	border: 1px solid ${palette.border};
	border-radius: ${radius.md};

	label {
		flex: 1;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
	}
	input {
		width: auto;
	}
	button {
		padding: 6px 10px;
	}
`;

export const Swatch = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 8px;

	input[type="color"] {
		width: 40px;
		height: 32px;
		padding: 2px;
	}
	span {
		width: 24px;
		height: 24px;
		border-radius: 6px;
		border: 1px solid ${palette.border};
	}
	code {
		font-size: 13px;
	}
`;

// The editor and its preview side by side on wide screens, stacked below.
export const WithPreview = styled.div<{ $open: boolean }>`
	display: grid;
	gap: 20px;
	align-items: start;

	@media (min-width: 1200px) {
		grid-template-columns: ${p => (p.$open ? "minmax(0, 1fr) minmax(0, 1.15fr)" : "minmax(0, 1fr)")};
	}
`;

export const PreviewBox = styled.section`
	min-width: 0;
	padding: 12px;
	border: 1px solid ${palette.border};
	border-radius: ${radius.lg};
	background: ${palette.surface};

	@media (min-width: 1200px) {
		position: sticky;
		top: 16px;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}
	h3 {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		font-size: 15px;
	}
	select {
		width: auto;
		padding-top: 6px;
		padding-bottom: 6px;
		font-size: 13px;
	}
	.toolbar a,
	.toolbar button {
		padding: 6px 10px;
		font-size: 13px;
	}
	.devices {
		display: inline-flex;
		border: 1px solid ${palette.border};
		border-radius: ${radius.md};
		overflow: hidden;
	}
	.devices button,
	.devices button:hover:not(:disabled) {
		display: inline-flex;
		padding: 6px 10px;
		border: none;
		border-radius: 0;
		color: ${palette.muted};
		background: ${palette.bg};
	}
	.devices button[aria-pressed="true"] {
		color: #ffffff;
		background: ${palette.primary};
	}
	.lead {
		margin: 0 0 8px;
		font-size: 12px;
	}
	.stage {
		display: flex;
		justify-content: center;
		overflow: hidden;
		border-radius: ${radius.md};
		background: #e7eaf2;
	}
	.stage > div {
		overflow: hidden;
	}
	iframe {
		display: block;
		border: 0;
		background: #ffffff;
		transform-origin: top left;
	}
	.inbox {
		display: grid;
		gap: 2px;
		padding: 10px 12px;
		margin-bottom: 8px;
		border-radius: ${radius.md};
		background: ${palette.bg};
		font-size: 13px;
	}
	.inbox span {
		color: ${palette.muted};
	}
`;
