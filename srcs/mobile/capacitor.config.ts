import type { CapacitorConfig } from "@capacitor/cli";

// The app is a native shell around the web app: the WebView loads
// CAP_SERVER_URL and shows www/offline.html when it cannot be reached.
// The URL is baked in at `cap sync` time (CI sets it per build):
//   - http://localhost:3000 (default) for the Android emulator in CI,
//     where `adb reverse` maps the emulator's localhost to the runner's
//     docker stack;
//   - the production https URL once the site is deployed.
const serverUrl = process.env.CAP_SERVER_URL ?? "http://localhost:3000";
const debug = process.env.CAP_RELEASE !== "true";

const config: CapacitorConfig = {
	appId: "com.itnyang.app",
	appName: "잇냥",
	webDir: "www",
	// Lets the web app tell it runs inside the app ("itnyang-app/<platform>").
	appendUserAgent: "itnyang-app",
	server: {
		url: serverUrl,
		cleartext: serverUrl.startsWith("http://"),
		errorPath: "offline.html",
	},
	android: {
		// Debug builds expose the WebView to Chrome DevTools / Playwright
		// (the CI screenshots drive the app through it).
		webContentsDebuggingEnabled: debug,
	},
	ios: {
		webContentsDebuggingEnabled: debug,
		contentInset: "never",
	},
};

export default config;
