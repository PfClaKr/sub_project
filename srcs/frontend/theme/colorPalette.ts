// Single source of design tokens (the old AppTheme/next-themes layer
// was removed). Muted text keeps >= 4.5:1 contrast on white.
// colors are the built-in values; palette refers to them through CSS
// variables (--c-<token>) so admins can change the theme at runtime
// (sitehandler ThemeTokens, ThemeStyle in the root layout). SVG
// attributes cannot read CSS variables: use colors there.
export const colors = {
	primary: "#0048b4",
	primaryHover: "#003a91",
	primarySoft: "#e1eeff",
	accent: "#3083ff",

	heading: "#101750",
	text: "#1f2433",
	muted: "#5d6382",

	bg: "#ffffff",
	surface: "#f6f7fb",
	border: "#dfe3f0",

	danger: "#c0392b",
	dangerSoft: "#fdecea",
	warning: "#9a5b00",
	warningSoft: "#fff3dc",
	done: "#4a4f63",
	doneSoft: "#e9ebf1",

	// From the paw logo (app/favicon.ico); used on the landing page.
	sky: "#8ad5fc",
	skySoft: "#e6f6ff",
	pink: "#f48fb1",
	pinkSoft: "#ffe8f0",
	fur: "#ffd9b0",
	furDark: "#f3b77c",
};

export type ColorToken = keyof typeof colors;

export function cssVar(token: ColorToken): string {
	return `--c-${token.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}`;
}

const palette = Object.fromEntries(
	(Object.keys(colors) as ColorToken[]).map(token => [token, `var(${cssVar(token)}, ${colors[token]})`]),
) as Record<ColorToken, string>;

export const radius = { sm: "6px", md: "10px", lg: "16px" };
export const shadow = {
	card: "0 1px 2px rgba(16, 23, 80, 0.06), 0 2px 8px rgba(16, 23, 80, 0.06)",
	hover: "0 4px 16px rgba(16, 23, 80, 0.12)",
};
export const breakpoint = { sm: "600px", md: "900px" };

export default palette;
