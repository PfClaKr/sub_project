// Writes www/app-config.js before `cap sync`, so the bundled offline page
// knows which URL to retry (the same value as capacitor.config.ts).
import { writeFileSync } from "node:fs";

const serverUrl = process.env.CAP_SERVER_URL ?? "http://localhost:3000";
// Debug builds let the tester type another server (make phone's tunnel).
const debug = process.env.CAP_RELEASE !== "true";
writeFileSync(
	new URL("../www/app-config.js", import.meta.url),
	`window.ITNYANG_SERVER_URL = ${JSON.stringify(serverUrl)};\nwindow.ITNYANG_DEBUG = ${debug};\n`,
);
console.log(`server URL: ${serverUrl}`);
