import { Metadata } from "next";

// components
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import StyledComponentsRegistry from "@/libs/registry";
import GlobalStyle from "@/styles/globalStyles";
import { Main } from "@/styles/styledLayout";

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
					<GlobalStyle />
					<Navigation />
					<Main>{children}</Main>
					{/* <Footer /> */}
				</StyledComponentsRegistry>
			</body>
		</html>
	);
}
