import { Metadata, Viewport } from "next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import StyledComponentsRegistry from "@/libs/registry";
import { SessionProvider } from "@/libs/session";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import GlobalStyle from "@/styles/globalStyles";
import { Main } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: {
		template: "%s | 잇냥",
		default: "잇냥 - 파리 한인 중고마켓",
	},
	description: "파리에 사는 한인들끼리 중고 물건을 사고파는 곳, 잇냥.",
	applicationName: "잇냥",
	appleWebApp: { capable: true, title: "잇냥", statusBarStyle: "default" },
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
	themeColor: "#0048b4",
	// Lets the installed app draw under the notch; paddings use safe-area insets.
	viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="ko">
			<body>
				<StyledComponentsRegistry>
					<GlobalStyle />
					<ServiceWorkerRegistrar />
					<SessionProvider>
						<ConfirmProvider>
							<Navigation />
							<Main>{children}</Main>
							<Footer />
						</ConfirmProvider>
					</SessionProvider>
				</StyledComponentsRegistry>
			</body>
		</html>
	);
}
