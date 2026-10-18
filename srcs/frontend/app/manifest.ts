import { MetadataRoute } from "next";

// Served at /manifest.webmanifest by Next.js.
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "잇냥 — 프랑스 한인 생활 커뮤니티",
		short_name: "잇냥",
		description: "중고거래, 집·알바 구하기, 생활 질문까지. 프랑스 한인 이웃들과 함께해요.",
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
			{ name: "질문하기", short_name: "질문", url: "/community/write?board=qna" },
			{ name: "판매하기", short_name: "판매", url: "/sell" },
			{ name: "집 구하기", short_name: "집", url: "/housing" },
			{ name: "내 채팅", short_name: "채팅", url: "/chat" },
		],
	};
}
