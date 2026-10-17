// Drives the debug app in the Android emulator (CI) and saves screenshots
// of the real screens. Debug builds expose the WebView to DevTools
// (capacitor.config.ts webContentsDebuggingEnabled): the script forwards
// the app's devtools socket and talks CDP to the page directly (Node's
// WebSocket; Playwright's connectOverCDP needs browser-level commands a
// WebView lacks). Screenshots are taken with adb, so they show the whole
// screen. Expects: the app installed, the backend + Next.js on the runner,
// demo data (scripts/demo.sh).
//
//   node scripts/android-screenshots.mjs <output dir>
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

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

// A minimal CDP page client: send(method, params) and evaluate(js).
async function connect(wsUrl) {
	const ws = new WebSocket(wsUrl);
	await new Promise((resolve, reject) => {
		ws.onopen = resolve;
		ws.onerror = reject;
	});
	let id = 0;
	const pending = new Map();
	ws.onmessage = e => {
		const msg = JSON.parse(e.data);
		const p = pending.get(msg.id);
		if (!p) return;
		pending.delete(msg.id);
		if (msg.error) p.reject(new Error(msg.error.message));
		else p.resolve(msg.result);
	};
	const send = (method, params = {}) => new Promise((resolve, reject) => {
		pending.set(++id, { resolve, reject });
		ws.send(JSON.stringify({ id, method, params }));
	});
	const evaluate = async js => {
		const r = await send("Runtime.evaluate", { expression: js, awaitPromise: true, returnByValue: true });
		if (r.exceptionDetails) throw new Error(`${js}: ${r.exceptionDetails.text}`);
		return r.result.value;
	};
	return {
		send,
		evaluate,
		url: () => evaluate("location.href").catch(() => ""),
		close: () => ws.close(),
	};
}

// (Re)starts the app and connects to its WebView page.
async function launch() {
	adb("shell", "am", "force-stop", pkg);
	adb("shell", "am", "start", "-W", "-n", `${pkg}/.MainActivity`);
	const pid = await until("the app process", () => tryAdb("shell", "pidof", pkg).trim());
	const socket = `webview_devtools_remote_${pid}`;
	await until("the WebView devtools socket", () => tryAdb("shell", "cat", "/proc/net/unix").includes(socket));
	tryAdb("forward", "--remove", "tcp:9222");
	adb("forward", "tcp:9222", `localabstract:${socket}`);
	const target = await until("the WebView page", async () => {
		const list = await fetch("http://127.0.0.1:9222/json").then(r => r.json()).catch(() => []);
		return list.find(t => t.type === "page" && t.webSocketDebuggerUrl);
	});
	return connect(target.webSocketDebuggerUrl);
}

// Waits for the document and its requests to settle.
async function settle(page) {
	await until("the page to load", () => page.evaluate("document.readyState === 'complete'").catch(() => false), 60);
	await sleep(2000);
}

// 1. Without the port mapping the site is unreachable: the bundled
//    offline page (www/offline.html) must show.
tryAdb("reverse", "--remove-all");
let page = await launch();
await until("the offline page", async () => (await page.url()).includes("offline.html"), 90);
await sleep(1500);
await shot("offline");
page.close();

// 2. Map the runner's services into the emulator and start again: the
//    app now opens the site.
for (const p of ports) adb("reverse", `tcp:${p}`, `tcp:${p}`);
page = await launch();
await until("the site", async () => (await page.url()).startsWith(base), 90);
await settle(page);

// Next.js navigation: wait for the network to settle, then a moment for
// images and reveal animations.
async function visit(path, name) {
	await page.send("Page.navigate", { url: base + path });
	await until(path, async () => (await page.url()) === base + path);
	await settle(page);
	await shot(name);
}
const js = JSON.stringify;

await visit("/", "home");
await visit("/search", "market");
await visit("/community", "community");
await visit("/housing", "housing");
await visit("/jobs", "jobs");
await visit("/product/demo-product-1", "product");

// Log in as the demo member through the real form (uncontrolled inputs,
// read with FormData on submit).
await visit("/login?next=/notifications", "login-page");
await page.evaluate(`
	document.querySelector("input[name=email]").value = ${js(user.email)};
	document.querySelector("input[name=password]").value = ${js(user.password)};
	true`);
await shot("login");
await page.evaluate(`document.querySelector("input[name=password]").form.requestSubmit(); true`);
await until("the notifications page", async () => (await page.url()) === `${base}/notifications`);
await settle(page);
await shot("notifications");

await visit("/chat", "chat-list");
await page.evaluate(`document.querySelector("a[href^='/chat/']").click(); true`);
await until("the chat room", () => page.evaluate(`document.body.innerText.includes("연결됨")`));
await sleep(1000);
await shot("chat-room");
await visit("/myaccount", "my-page");
await visit("/sell", "sell");

page.close();
clearTimeout(watchdog);
