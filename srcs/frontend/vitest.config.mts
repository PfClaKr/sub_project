import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure modules (libs/*, i18n/*). Node environment: no DOM or React.
export default defineConfig({
	test: {
		environment: "node",
		include: ["libs/**/*.test.ts", "i18n/**/*.test.ts"],
	},
	resolve: {
		alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
	},
});
