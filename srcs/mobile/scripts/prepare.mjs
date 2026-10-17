// Writes www/offline.html before `cap sync`: the page the app shows when
// the site cannot be reached (capacitor.config.ts errorPath). Android
// loads that page alone (other www files are requested from the server
// URL), so the icon and the config are inlined.
import { readFileSync, writeFileSync } from "node:fs";

const serverUrl = process.env.CAP_SERVER_URL ?? "http://localhost:3000";
// Debug builds let the tester type another server (make phone's tunnel).
const debug = process.env.CAP_RELEASE !== "true";

const file = name => new URL(`../${name}`, import.meta.url);
const icon = `data:image/png;base64,${readFileSync(file("assets/offline-icon.png")).toString("base64")}`;
const config = `window.ITNYANG_SERVER_URL = ${JSON.stringify(serverUrl)}; window.ITNYANG_DEBUG = ${debug};`;
const html = readFileSync(file("templates/offline.html"), "utf8").replace("{{ICON}}", icon).replace("{{CONFIG}}", config);
writeFileSync(file("www/offline.html"), html);
console.log(`server URL: ${serverUrl}${debug ? " (debug)" : ""}`);
