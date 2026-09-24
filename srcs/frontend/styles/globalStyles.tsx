'use client';

import { createGlobalStyle } from "styled-components";
import palette, { radius } from "@/theme/colorPalette";

const GlobalStyle = createGlobalStyle`
	*, *::before, *::after {
		box-sizing: border-box;
	}
	html {
		-webkit-text-size-adjust: 100%;
	}
	body {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
			"Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
		color: ${palette.text};
		background-color: ${palette.bg};
		line-height: 1.5;
		word-break: keep-all;
		overflow-wrap: anywhere;
	}
	h1, h2, h3 {
		color: ${palette.heading};
		line-height: 1.3;
	}
	a {
		color: inherit;
	}
	img {
		max-width: 100%;
		display: block;
	}
	button svg, a svg {
		flex: none;
	}
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		cursor: pointer;
		border: 1px solid transparent;
		border-radius: ${radius.sm};
		padding: 9px 16px;
		background-color: ${palette.primary};
		color: #ffffff;
		font: inherit;
		font-weight: 600;
		font-size: 14px;
		transition: background-color 0.15s;
	}
	button:hover:not(:disabled) {
		background-color: ${palette.primaryHover};
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	input, textarea, select {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid ${palette.border};
		border-radius: ${radius.sm};
		font: inherit;
		color: inherit;
		background-color: ${palette.bg};
	}
	input::placeholder, textarea::placeholder {
		color: ${palette.muted};
		opacity: 0.8;
	}
	input:hover:not(:disabled):not(:focus), textarea:hover:not(:disabled):not(:focus), select:hover:not(:disabled):not(:focus) {
		border-color: ${palette.muted};
	}
	input:disabled, textarea:disabled, select:disabled {
		background-color: ${palette.surface};
		cursor: not-allowed;
	}
	textarea {
		resize: vertical;
		min-height: 96px;
	}
	/* Native select chrome replaced by one chevron everywhere. */
	select {
		appearance: none;
		-webkit-appearance: none;
		padding-right: 36px;
		cursor: pointer;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235d6382' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		background-size: 16px;
	}
	/* No spinner arrows on number fields, no native clear on search. */
	input[type="number"] {
		-moz-appearance: textfield;
	}
	input[type="number"]::-webkit-outer-spin-button,
	input[type="number"]::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type="search"]::-webkit-search-cancel-button,
	input[type="search"]::-webkit-search-decoration {
		-webkit-appearance: none;
	}
	/* Map pin (Leaflet divIcon): a teardrop in the brand colour. */
	.itnyang-pin span {
		display: block;
		width: 30px;
		height: 30px;
		border-radius: 50% 50% 50% 0;
		background: ${palette.primary};
		border: 3px solid #ffffff;
		box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
		transform: rotate(-45deg);
	}
	.itnyang-pin span::after {
		content: "";
		position: absolute;
		inset: 8px;
		border-radius: 50%;
		background: #ffffff;
	}
	.leaflet-container {
		font: inherit;
		border-radius: ${radius.md};
		z-index: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		*, *::before, *::after {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
			scroll-behavior: auto !important;
		}
	}
	html {
		scroll-behavior: smooth;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	:focus-visible {
		outline: 2px solid ${palette.accent};
		outline-offset: 2px;
	}
	input:focus, textarea:focus, select:focus {
		outline: 2px solid ${palette.accent};
		outline-offset: 0;
		border-color: transparent;
	}
`;

export default GlobalStyle;
