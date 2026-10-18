import { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
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

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("meta");
	return {
		title: { template: t("titleTemplate"), default: t("titleDefault") },
		description: t("description"),
		applicationName: t("siteName"),
		appleWebApp: { capable: true, title: t("siteName"), statusBarStyle: "default" },
	};
}

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 5,
	themeColor: "#0048b4",
	// Lets the installed app draw under the notch; paddings use safe-area insets.
	viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
	const locale = await getLocale();
	const messages = await getMessages();
	return (
		// The home page's pre-paint script may add data-arrival-hidden
		// (libs/arrival.ts) before React hydrates.
		<html lang={locale} suppressHydrationWarning>
			<body>
				<NextIntlClientProvider locale={locale} messages={messages}>
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
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
