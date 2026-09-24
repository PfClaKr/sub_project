/** @type {import('next').NextConfig} */
const nextConfig = {
	// Stable styled-components class names between SSR and the client
	// (avoids hydration className mismatches).
	compiler: {
		styledComponents: true,
	},
};

export default nextConfig;
