import palette from "./colorPalette";

const app = {
	color: {
		default: palette.fg.default,
		primary: palette.fg[300],
		bg_default: palette.bg.default,
	},
}

const product = {
	text: {
		// price
		primary: {
			color: palette.fg[500],
			size: '20px',
			weight: '800',
		},
		// name
		secondary: {
			color: palette.fg[300],
			size: '15px',
			weight: '700',
		},
		// detail
		sub: {
			color: palette.fg[100],
			size: '14px',
			weight: '400',
		},
	},
	// bg
	bg: {
		normal: palette.bg[100],
		hover: palette.bg[300],
	}
}

const AppTheme = {
	app,
	product,
}

export default AppTheme;
