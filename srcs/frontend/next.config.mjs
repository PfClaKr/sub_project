import createNextIntlPlugin from "next-intl/plugin";

// Messages per language: i18n/request.ts picks the locale per request.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
	// The production image (docker/frontend/Dockerfile.prod) ships only the
	// traced server files, which keeps it small and light on memory.
	output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
	// Stable styled-components class names between SSR and the client
	// (avoids hydration className mismatches).
	poweredByHeader: false,
	compiler: {
		styledComponents: true,
	},
};

export default withNextIntl(nextConfig);
