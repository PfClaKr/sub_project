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
		line-height: 1.5;
	}
	h1, h2 {
		color: ${palette.fg[700]};
	}
	button {
		cursor: pointer;
		border: none;
		border-radius: 6px;
		padding: 8px 14px;
		background-color: ${palette.fg[500]};
		color: #ffffff;
		font-weight: 600;
		font-size: 14px;
	}
	button:hover {
		background-color: ${palette.fg[300]};
	}
	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
	input, textarea, select {
		padding: 10px 12px;
		border: 1px solid ${palette.bg[500]};
		border-radius: 6px;
		font: inherit;
		background-color: ${palette.bg[100]};
	}
	input:focus, textarea:focus, select:focus {
		outline: 2px solid ${palette.fg[300]};
	}
`;

export default GlobalStyle;
