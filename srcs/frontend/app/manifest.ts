import { MetadataRoute } from "next";

// Served at /manifest.webmanifest by Next.js.
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "itnyang — 파리 한인 중고마켓",
		short_name: "잇냥",
		description: "파리 한인 중고거래, 사고팔 물건 있냥?",
		start_url: "/",
		scope: "/",
		display: "standalone",
		orientation: "portrait",
		background_color: "#ffffff",
		theme_color: "#0048b4",
		lang: "ko",
		categories: ["shopping", "lifestyle"],
		icons: [
			{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
			{ src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
		],
		shortcuts: [
			{ name: "판매하기", short_name: "판매", url: "/sell" },
			{ name: "상품 찾기", short_name: "검색", url: "/search" },
			{ name: "내 채팅", short_name: "채팅", url: "/chat" },
		],
	};
}
