import { MetadataRoute } from "next";
import { getLocale, getTranslations } from "next-intl/server";

// Served at /manifest.webmanifest by Next.js, in the visitor's language.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
	const t = await getTranslations("manifest");
	const brand = (await getTranslations("nav"))("brand");
	return {
		name: t("name"),
		short_name: brand,
		description: t("description"),
		start_url: "/",
		scope: "/",
		display: "standalone",
		orientation: "portrait",
		background_color: "#ffffff",
		theme_color: "#0048b4",
		lang: await getLocale(),
		categories: ["shopping", "lifestyle"],
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
			{ src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
		shortcuts: [
			{ name: t("ask"), short_name: t("askShort"), url: "/community/write?board=qna" },
			{ name: t("sell"), short_name: t("sellShort"), url: "/sell" },
			{ name: t("housing"), short_name: t("housingShort"), url: "/housing" },
			{ name: t("chat"), short_name: t("chatShort"), url: "/chat" },
		],
	};
}
