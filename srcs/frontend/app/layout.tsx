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
import { NoticeBanner } from "@/components/NoticeBanner";
import { PreviewBar } from "@/components/PreviewBar";
import { getSite } from "@/libs/site.server";
import { colors, cssVar, type ColorToken } from "@/theme/colorPalette";

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
	const { Settings: site, Preview: preview } = await getSite(locale);
	const notice = site.Notice;
	const noticeText = notice.Enabled ? notice.Text[locale] || notice.Text.ko || "" : "";
	// Theme colours changed on /admin/site, as CSS variables over the
	// built-in values (theme/colorPalette.ts).
	const themeCss = (Object.entries(site.Theme) as [ColorToken, string][])
		.filter(([token, value]) => token in colors && /^#[0-9a-f]{6}$/i.test(value))
		.map(([token, value]) => `${cssVar(token)}:${value}`)
		.join(";");
	return (
		// The home page's pre-paint script may add data-arrival-hidden
		// (libs/arrival.ts) before React hydrates.
		<html lang={locale} suppressHydrationWarning>
			<body>
				{themeCss && <style dangerouslySetInnerHTML={{ __html: `:root{${themeCss}}` }} />}
				<NextIntlClientProvider locale={locale} messages={messages}>
					<StyledComponentsRegistry>
						<GlobalStyle />
						<ServiceWorkerRegistrar />
						<SessionProvider>
							<NotificationProvider>
								<RegionProvider>
									<ConfirmProvider>
										{preview && <PreviewBar />}
										<Navigation />
										{noticeText && <NoticeBanner text={noticeText} tone={notice.Tone} link={notice.Link} version={notice.Version} alwaysShow={preview} />}
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
