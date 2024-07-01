import { Metadata } from "next";

// components
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import StyledComponentsRegistry from "@/libs/registry";

// theme
// import { createGlobalStyle } from "styled-components";
// import { ThemeProvider } from "@/theme/theme-provider";
// import AppTheme from "@/theme/ui";

export const metadata: Metadata = {
	title: {
		template: "%s | itnyang",
		default: "itnyang",
	},
	description: "itnyang test page",
};

// const Layout = ({ children } : Props) => {
// 	const [currentTheme, setCurrentTheme] = useRecoilState(currentThemeState);

// 	useEffect(() => {
// 	  if (localStorage.getItem('dark_mode') !== undefined) {
// 		const localTheme = Number(localStorage.getItem('dark_mode'));
// 		setCurrentTheme(localTheme);
// 	  }
// 	}, [setCurrentTheme]);

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>
				<StyledComponentsRegistry>
					{/* <ThemeProvider themes={['light', 'dark']}> */}
					<Navigation />
					<br />
					<hr />
					{children}
					<br />
					<hr />
					{/* <Footer /> */}
					{/* </ThemeProvider> */}
				</StyledComponentsRegistry>
			</body>
		</html>
	);
}
