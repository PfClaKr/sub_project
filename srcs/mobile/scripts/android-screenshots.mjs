// Drives the debug app in the Android emulator (CI) and saves screenshots
// of the real screens: the WebView is reached through Chrome DevTools,
// which debug builds expose (capacitor.config.ts webContentsDebuggingEnabled).
// Expects: the app installed, the backend + Next.js on the runner, demo
// data (scripts/demo.sh), and `adb reverse` for the ports listed below.
//
//   node scripts/android-screenshots.mjs <output dir>
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { _android as android } from "playwright-core";

const out = process.argv[2] ?? "screenshots";
const pkg = "com.itnyang.app";
const base = "http://localhost:3000";
const ports = [3000, 8080, 7070, 9090, 9000];
const user = { email: process.env.DEMO_USER_EMAIL ?? "user@itnyang.test", password: process.env.DEMO_PASSWORD ?? "itnyang1234" };
mkdirSync(out, { recursive: true });

const adb = (...args) => execFileSync("adb", args, { encoding: "utf8" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let n = 0;

const [device] = await android.devices({ omitDriverInstall: true });
if (!device) throw new Error("no Android device");
console.log(`device: ${device.model()} (${device.serial()})`);

async function shot(name) {
	const file = `${out}/${String(++n).padStart(2, "0")}-${name}.png`;
	await device.screenshot({ path: file });
	console.log(`saved ${file}`);
}

// 1. Without the port mapping the site is unreachable: the bundled
//    offline page (www/offline.html) must show.
try {
	adb("reverse", "--remove-all");
} catch {
	// nothing mapped yet
}
adb("shell", "am", "force-stop", pkg);
adb("shell", "am", "start", "-n", `${pkg}/.MainActivity`);
await sleep(8000);
await shot("offline");

// 2. Map the runner's services into the emulator and start again: the
//    app now opens the site. (Retrying from the offline page would work
//    too, but the WebView then moves to a new DevTools target.)
for (const p of ports) adb("reverse", `tcp:${p}`, `tcp:${p}`);
adb("shell", "am", "force-stop", pkg);
adb("shell", "am", "start", "-n", `${pkg}/.MainActivity`);
const webview = await device.webView({ pkg }, { timeout: 60_000 });
const page = await webview.page();
page.setDefaultTimeout(60_000);
await page.waitForURL(`${base}/**`);

// Next.js navigation: wait for the network to settle, then a moment for
// images and reveal animations.
async function visit(path, name, after) {
	await page.goto(base + path, { waitUntil: "networkidle" });
	if (after) await after();
	await sleep(1500);
	await shot(name);
}

await visit("/", "home");
await visit("/search", "market");
await visit("/community", "community");
await visit("/housing", "housing");
await visit("/jobs", "jobs");
await visit("/product/demo-product-1", "product");

// Log in as the demo member through the real form.
await page.goto(`${base}/login?next=/notifications`, { waitUntil: "networkidle" });
await page.fill("input[name=email]", user.email);
await page.fill("input[name=password]", user.password);
await shot("login");
await page.click("form:has(input[name=password]) button[type=submit]");
await page.waitForURL(`${base}/notifications`);
await page.waitForLoadState("networkidle");
await sleep(1500);
await shot("notifications");

await visit("/chat", "chat-list");
await page.click("a[href^='/chat/']");
await page.waitForLoadState("networkidle");
await page.waitForSelector("text=연결됨");
await sleep(1000);
await shot("chat-room");
await visit("/myaccount", "my-page");
await visit("/sell", "sell");

await device.close();
