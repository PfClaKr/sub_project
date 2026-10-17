// Drives the debug app in the Android emulator (CI) and saves screenshots
// of the real screens. Debug builds expose the WebView to DevTools
// (capacitor.config.ts webContentsDebuggingEnabled): the script forwards
// the app's devtools socket and connects Playwright over CDP; screenshots
// are taken with adb, so they show the whole screen.
// Expects: the app installed, the backend + Next.js on the runner, demo
// data (scripts/demo.sh).
//
//   node scripts/android-screenshots.mjs <output dir>
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const out = process.argv[2] ?? "screenshots";
const pkg = "com.itnyang.app";
const base = "http://localhost:3000";
const ports = [3000, 8080, 7070, 9090, 9000];
const user = { email: process.env.DEMO_USER_EMAIL ?? "user@itnyang.test", password: process.env.DEMO_PASSWORD ?? "itnyang1234" };
mkdirSync(out, { recursive: true });

// A hung WebView must not keep the CI job until its timeout.
const watchdog = setTimeout(() => {
	console.error("screenshots: gave up after 20 minutes");
	process.exit(1);
}, 20 * 60_000);

const adb = (...args) => execFileSync("adb", args, { encoding: "utf8" });
const tryAdb = (...args) => {
	try {
		return adb(...args);
	} catch {
		return "";
	}
};
const sleep = ms => new Promise(r => setTimeout(r, ms));
let n = 0;

async function shot(name) {
	tryAdb("shell", "am", "broadcast", "-a", "android.intent.action.CLOSE_SYSTEM_DIALOGS");
	await sleep(500);
	const file = `${out}/${String(++n).padStart(2, "0")}-${name}.png`;
	writeFileSync(file, execFileSync("adb", ["exec-out", "screencap", "-p"], { maxBuffer: 64 << 20 }));
	console.log(`saved ${file}`);
}

async function until(what, check, seconds = 60) {
	for (let i = 0; i < seconds; i++) {
		const v = await check();
		if (v) return v;
		await sleep(1000);
	}
	throw new Error(`timed out waiting for ${what}`);
}

// (Re)starts the app and connects to its WebView.
async function launch() {
	adb("shell", "am", "force-stop", pkg);
	adb("shell", "am", "start", "-W", "-n", `${pkg}/.MainActivity`);
	const pid = await until("the app process", () => tryAdb("shell", "pidof", pkg).trim());
	const socket = `webview_devtools_remote_${pid}`;
	await until("the WebView devtools socket", () => tryAdb("shell", "cat", "/proc/net/unix").includes(socket));
	tryAdb("forward", "--remove", "tcp:9222");
	adb("forward", "tcp:9222", `localabstract:${socket}`);
	const browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 60_000 });
	const page = await until("the WebView page", () => browser.contexts()[0]?.pages()[0]);
	page.setDefaultTimeout(60_000);
	return { browser, page };
}

// 1. Without the port mapping the site is unreachable: the bundled
//    offline page (www/offline.html) must show.
tryAdb("reverse", "--remove-all");
let { browser, page } = await launch();
await until("the offline page", () => page.url().includes("offline.html"), 90);
await sleep(1500);
await shot("offline");
await browser.close();

// 2. Map the runner's services into the emulator and start again: the
//    app now opens the site.
for (const p of ports) adb("reverse", `tcp:${p}`, `tcp:${p}`);
({ browser, page } = await launch());
await until("the site", () => page.url().startsWith(base), 90);
await page.waitForLoadState("networkidle");

// Next.js navigation: wait for the network to settle, then a moment for
// images and reveal animations.
async function visit(path, name) {
	await page.goto(base + path, { waitUntil: "networkidle" });
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

await browser.close();
clearTimeout(watchdog);
