'use client';

import styled from "styled-components";
import palette, { breakpoint, radius, shadow } from "@/theme/colorPalette";

export const BoardHeader = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	margin: 8px 0 16px;

	h1 {
		margin: 0;
		font-size: 26px;
	}
`;

export const Toolbar = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	margin-bottom: 16px;

	form {
		flex: 1 1 240px;
		display: flex;
		gap: 8px;
	}
	select {
		width: auto;
		min-width: 120px;
	}

	/* Phones: the search box on its own line, then the filters packed
	   together, so the list starts higher on the screen. */
	@media (max-width: ${breakpoint.sm}) {
		gap: 6px;

		form {
			order: -1;
			flex-basis: 100%;
		}
		select {
			min-width: 0;
			padding-top: 7px;
			padding-bottom: 7px;
			font-size: 14px;
		}
		button {
			font-size: 14px;
		}
	}
`;

// Region filter shaped like a chip, with a pin icon in front.
export const RegionSelect = styled.label`
	position: relative;
	display: inline-flex;
	align-items: center;

	svg {
		position: absolute;
		left: 12px;
		color: ${palette.primary};
		pointer-events: none;
	}
	select {
		width: auto;
		padding: 7px 34px 7px 34px;
		border-radius: 999px;
		font-size: 14px;
		font-weight: 600;
		color: ${palette.primary};
		border-color: ${palette.primarySoft};
		background-color: ${palette.primarySoft};
	}
`;

export const PostRows = styled.ul`
	margin: 0;
	padding: 0;
	list-style: none;
	border-top: 1px solid ${palette.border};

	> li {
		border-bottom: 1px solid ${palette.border};
	}
`;

export const PostRowLink = styled.a`
	display: block;
	padding: 14px 4px;
	color: ${palette.text};
	text-decoration: none;

	&:hover h3 {
		color: ${palette.primary};
	}
	h3 {
		margin: 4px 0 2px;
		font-size: 16px;
		line-height: 1.4;
		overflow-wrap: anywhere;
	}
	p {
		margin: 0;
		font-size: 14px;
		color: ${palette.muted};
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
`;

export const Meta = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px 10px;
	font-size: 12px;
	color: ${palette.muted};

	span {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}
`;

export const Tag = styled.span<{ $tone?: "primary" | "done" | "warning" }>`
	display: inline-block;
	padding: 2px 8px;
	border-radius: 999px;
	font-size: 12px;
	font-weight: 700;
	color: ${p => (p.$tone === "done" ? "#1d7a46" : p.$tone === "warning" ? palette.warning : palette.primary)};
	background-color: ${p => (p.$tone === "done" ? "#e3f6ea" : p.$tone === "warning" ? palette.warningSoft : palette.primarySoft)};
`;

export const Article = styled.article`
	max-width: 760px;

	h1 {
		margin: 8px 0 10px;
		font-size: 24px;
		line-height: 1.35;
		overflow-wrap: anywhere;
	}
`;

export const AuthorLine = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
	padding-bottom: 16px;
	border-bottom: 1px solid ${palette.border};

	strong {
		display: block;
		font-size: 14px;
	}
`;

export const Body = styled.div`
	margin: 20px 0;
	font-size: 16px;
	line-height: 1.75;
	white-space: pre-wrap;
	overflow-wrap: anywhere;

	a {
		color: ${palette.primary};
	}
`;

export const Photos = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
	gap: 8px;
	margin-bottom: 20px;

	img {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: ${radius.md};
		background-color: ${palette.surface};
	}
`;

export const ActionBar = styled.div`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
	padding: 12px 0;
	border-top: 1px solid ${palette.border};
	border-bottom: 1px solid ${palette.border};
`;

export const ToggleButton = styled.button<{ $on?: boolean }>`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 7px 12px;
	border-radius: 999px;
	font-size: 14px;
	font-weight: 600;
	border: 1px solid ${p => (p.$on ? palette.primary : palette.border)};
	color: ${p => (p.$on ? palette.primary : palette.text)};
	background-color: ${p => (p.$on ? palette.primarySoft : palette.bg)};

	&:hover:not(:disabled) {
		border-color: ${palette.primary};
		background-color: ${palette.primarySoft};
	}
`;

export const TextButton = styled.button<{ $danger?: boolean }>`
	padding: 4px 6px;
	border: 0;
	background: none;
	font-size: 13px;
	font-weight: 500;
	color: ${p => (p.$danger ? palette.danger : palette.muted)};

	&:hover:not(:disabled) {
		color: ${p => (p.$danger ? palette.danger : palette.primary)};
		background: none;
		text-decoration: underline;
	}
`;

export const CommentSection = styled.section`
	margin-top: 24px;

	> h2 {
		margin: 0 0 12px;
		font-size: 18px;
	}
`;

export const CommentItem = styled.div<{ $reply?: boolean; $accepted?: boolean }>`
	position: relative;
	padding: 14px ${p => (p.$accepted ? "14px" : "0")};
	margin-left: ${p => (p.$reply ? "28px" : "0")};
	border-top: 1px solid ${palette.border};
	${p => p.$accepted && `
		border: 2px solid #3aa86b;
		border-radius: ${radius.md};
		background-color: #f3fbf6;
		margin-bottom: 8px;
	`}
	scroll-margin-top: 90px;

	&:target {
		background-color: ${palette.primarySoft};
	}
	header {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
	}
	header strong {
		font-size: 14px;
	}
	p {
		margin: 6px 0 4px;
		line-height: 1.6;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	footer {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: -6px;
	}

	@media (max-width: ${breakpoint.sm}) {
		margin-left: ${p => (p.$reply ? "16px" : "0")};
	}
`;

export const CommentForm = styled.form`
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin: 12px 0;

	textarea {
		min-height: 72px;
	}
	> div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	label {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		color: ${palette.muted};
	}
	label input {
		width: auto;
	}
`;

export const SimilarBox = styled.aside`
	padding: 12px 14px;
	border-radius: ${radius.md};
	background-color: ${palette.surface};
	font-size: 14px;

	strong {
		display: block;
		margin-bottom: 6px;
	}
	ul {
		margin: 0;
		padding-left: 18px;
		line-height: 1.8;
	}
	a {
		color: ${palette.primary};
	}
`;

// Two by two on wide screens (four cards never leave one alone on a row),
// one column on phones with three entries per card to keep the page short.
export const HubGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 16px;
	margin: 8px 0 40px;

	@media (max-width: ${breakpoint.md}) {
		grid-template-columns: 1fr;
	}
	@media (max-width: ${breakpoint.sm}) {
		ul > li:nth-child(n + 4) {
			display: none;
		}
	}
`;

export const HubCard = styled.section`
	padding: 18px 18px 8px;
	border: 1px solid ${palette.border};
	border-radius: ${radius.lg};
	box-shadow: ${shadow.card};

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 4px;
	}
	h2 {
		margin: 0;
		font-size: 17px;
	}
	header a {
		font-size: 13px;
		color: ${palette.primary};
		text-decoration: none;
	}
	ul {
		border-top: 0;
	}
	li:last-child {
		border-bottom: 0;
	}
`;

export const ReportOptions = styled.fieldset`
	margin: 12px 0;
	padding: 0;
	border: 0;
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 8px;
	text-align: left;

	label {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border: 1px solid ${palette.border};
		border-radius: ${radius.sm};
		font-size: 14px;
		cursor: pointer;
	}
	label:has(input:checked) {
		border-color: ${palette.primary};
		background-color: ${palette.primarySoft};
	}
	input {
		width: auto;
	}
`;
