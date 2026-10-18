import { Metadata, Viewport } from "next";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import BottomTabs from "@/components/BottomTabs";
import { SuspendedBanner } from "@/components/ui/SuspendedBanner";
import { NotificationProvider } from "@/libs/notifications";
import { RegionProvider } from "@/libs/region";
import StyledComponentsRegistry from "@/libs/registry";
import { SessionProvider } from "@/libs/session";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import GlobalStyle from "@/styles/globalStyles";
import { Main } from "@/styles/styledLayout";

export const metadata: Metadata = {
	title: {
		template: "%s | 잇냥",
		default: "잇냥 - 프랑스 한인 생활 커뮤니티",
	},
	description: "프랑스에 사는 한인들이 중고 물건을 사고팔고, 집과 알바를 구하고, 생활 질문을 묻고 답하는 곳, 잇냥.",
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
		// The home page's pre-paint script may add data-arrival-hidden
		// (libs/arrival.ts) before React hydrates.
		<html lang="ko" suppressHydrationWarning>
			<body>
				<StyledComponentsRegistry>
					<GlobalStyle />
					<ServiceWorkerRegistrar />
					<SessionProvider>
						<NotificationProvider>
							<RegionProvider>
								<ConfirmProvider>
									<Navigation />
									<SuspendedBanner />
									<Main>{children}</Main>
									<Footer />
									<BottomTabs />
								</ConfirmProvider>
							</RegionProvider>
						</NotificationProvider>
					</SessionProvider>
				</StyledComponentsRegistry>
			</body>
		</html>
	);
}
