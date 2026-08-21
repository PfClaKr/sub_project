'use client';

import { createGlobalStyle } from "styled-components";
import palette from "@/theme/colorPalette";

const GlobalStyle = createGlobalStyle`
	*, *::before, *::after {
		box-sizing: border-box;
	}
	body {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
			"Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
		color: ${palette.fg.default};
		background-color: ${palette.bg.default};
		line-height: 1.6;
		-webkit-font-smoothing: antialiased;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}
	/* Keep the footer at the bottom on short pages. */
	main {
		flex: 1;
		width: 100%;
	}
	h1, h2, h3 {
		color: ${palette.fg[700]};
		letter-spacing: -0.02em;
	}
	a {
		color: ${palette.fg[300]};
	}
	button {
		cursor: pointer;
		border: none;
		border-radius: 8px;
		padding: 10px 16px;
		background-color: ${palette.fg[500]};
		color: #ffffff;
		font-family: inherit;
		font-weight: 600;
		font-size: 14px;
		transition: background-color 0.15s ease, opacity 0.15s ease;
	}
	button:hover:not(:disabled) {
		background-color: ${palette.fg[300]};
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	input, textarea, select {
		padding: 10px 12px;
		border: 1px solid ${palette.line};
		border-radius: 8px;
		font: inherit;
		color: inherit;
		background-color: ${palette.bg.default};
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}
	input:focus, textarea:focus, select:focus {
		outline: none;
		border-color: ${palette.fg[300]};
		box-shadow: 0 0 0 3px ${palette.bg[300]};
	}
	textarea {
		resize: vertical;
	}
	::placeholder {
		color: ${palette.fg[100]};
		opacity: 0.8;
	}
`;

export default GlobalStyle;
