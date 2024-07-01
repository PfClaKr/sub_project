import palette from "./colorPalette";

const product = {
	text: {
		// price
		primary: {
			color: palette.primary.fg[500],
			size: '20px',
			weight: '800',
		},
		// name
		secondary: {
			color: palette.primary.fg[300],
			size: '15px',
			weight: '700',
		},
		// detail
		sub: {
			color: palette.primary.fg[100],
			size: '14px',
			weight: '400',
		},
	},
	// bg
	bg: {
		normal: palette.primary.bg[100],
		hover: palette.primary.bg[300],
	}
}

const AppTheme = {
	product,
}

export default AppTheme;
