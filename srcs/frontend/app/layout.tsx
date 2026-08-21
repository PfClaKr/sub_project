import { Metadata, Viewport } from "next";

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
	description: "파리 한인 중고마켓 — 사고팔 물건 있냥?",
};

// Mobile web app: fit the device width and allow user zoom.
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
	themeColor: "#0048b4",
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
		<html lang="ko">
			<body>
				<StyledComponentsRegistry>
					<GlobalStyle />
					<Navigation />
					<Main>{children}</Main>
					<Footer />
				</StyledComponentsRegistry>
			</body>
		</html>
	);
}
