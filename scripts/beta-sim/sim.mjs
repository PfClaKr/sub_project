// Beta traffic simulation (scripts/beta-sim/README.md).
//
// Real Chromium browsers play beta members against the production
// rehearsal: they open pages, scroll, click cards, type searches, like,
// comment, chat and post with phone-sized photos, through the same APIs
// the site uses. Each phase records what that cost:
//   - DynamoDB request units (ddbmeter), per operation and table;
//   - bytes the browsers received, split into what the Lightsail server
//     sends (pages, RSC, static files, API) and what S3 sends (/media);
//   - CPU time and memory of each container (docker stats);
//   - uploads (S3 PUTs, bytes stored) and mails (MailHog).
//
// Phases: accounts (members via the loginserver CLI), content (what the
// first weeks of a beta would hold), idle (the stack doing nothing, as a
// baseline), beta (browsing days), load (rising
// parallel sessions without think time, for capacity). Results go to
// <out>/<phase>.json and are summed up by cost.mjs.
import { chromium } from "playwright";
import { execFile, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";

const args = Object.fromEntries(
	process.argv.slice(2).map(a => {
		const [k, v] = a.replace(/^--/, "").split("=");
		return [k, v ?? "true"];
	}),
);
const BASE = args.base ?? "https://localhost:8443";
const METER = args.meter ?? "http://localhost:8100";
const MAILHOG = args.mailhog ?? "http://localhost:8026";
const USERS = Number(args.users ?? 150);
const DAYS = Number(args.days ?? 2);
const PARALLEL = Number(args.parallel ?? 8);
const OUT = args.out ?? "scripts/beta-sim/results";
const PHASES = (args.phase ?? "accounts,content,idle,beta,load").split(",");
const PASSWORD = "itnyang1234";
const COMPOSE_PROJECT = "itnyang-rehearsal";

// Server-side containers (what runs on the Lightsail host).
const SERVER = ["caddy", "nextjs", "apiserver", "loginserver", "chatserver", "elasticsearch"];

// ---- deterministic randomness ----
let seed = Number(args.seed ?? 42);
function rand() {
	seed |= 0;
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rnd = n => Math.floor(rand() * n);
const pick = list => list[rnd(list.length)];
const chance = p => rand() < p;
const between = (a, b) => a + rand() * (b - a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- members ----
const email = i => `beta-${String(i).padStart(3, "0")}@sim.itnyang`;
const nickname = i => `베타${String(i).padStart(3, "0")}`;
// 10% post a lot, 30% take part, 60% mostly read (a usual community split).
const persona = i => (i % 10 === 0 ? "poster" : i % 10 <= 3 ? "active" : "lurker");

// A few Paris points: the area lookup per point is cached, so Nominatim
// (a public service) sees only a handful of requests.
const POINTS = [
	[48.8414, 2.2989], [48.8638, 2.3707], [48.8462, 2.3449], [48.8794, 2.355],
	[48.835, 2.3215], [48.8925, 2.3444], [48.8566, 2.3522],
];
const QUERIES = ["아이폰", "이케아 소파", "자전거", "전기포트", "노트북", "책상", "매트리스", "밥솥", "겨울 코트", "모니터"];
const PRODUCTS = [
	["아이폰 13 미니 128GB", "전자기기", 350], ["이케아 말름 서랍장", "가구", 60], ["쿠쿠 전기밥솥 6인용", "기타", 70],
	["델 27인치 모니터", "전자기기", 90], ["겨울 패딩 (M)", "의류", 40], ["프랑스어 교재 세트", "도서", 25],
	["벨로 자전거 26인치", "기타", 120], ["원목 책상", "가구", 80], ["필립스 전기포트", "기타", 12], ["맥북 에어 M1", "전자기기", 550],
];
const POST_TOPICS = { free: ["일상", "정보", "맛집·장보기", "행사·모임", "고민"], qna: ["체류증·비자", "행정·CAF·세금", "은행·통신", "의료", "집·이사", "기타"] };

// ---- measurement ----
function newTally() {
	return {
		pageviews: 0,
		pages: {},
		actions: {},
		requests: {},
		bytes: {},
		latency: { document: [], rsc: [], api: [] },
		uploads: { files: 0, bytes: 0 },
	};
}
let tally = newTally();
const pending = new Set();

function classify(url, req) {
	const u = new URL(url);
	if (u.origin !== new URL(BASE).origin) return "external";
	if (u.pathname.startsWith("/media/")) return "media"; // S3 in production
	if (u.pathname.startsWith("/svc/")) return "api";
	if (req.resourceType() === "document") return "document";
	if (u.searchParams.has("_rsc") || req.headers()["rsc"] === "1") return "rsc";
	return "static";
}

function watch(context) {
	context.on("requestfinished", req => {
		const p = (async () => {
			const cls = classify(req.url(), req);
			const sizes = await req.sizes().catch(() => null);
			const timing = req.timing();
			tally.requests[cls] = (tally.requests[cls] ?? 0) + 1;
			if (sizes) tally.bytes[cls] = (tally.bytes[cls] ?? 0) + sizes.responseBodySize + sizes.responseHeadersSize;
			if (tally.latency[cls] && timing.responseEnd > 0) tally.latency[cls].push(timing.responseEnd);
		})();
		pending.add(p);
		p.finally(() => pending.delete(p));
	});
}

const count = (bucket, key, n = 1) => (bucket[key] = (bucket[key] ?? 0) + n);

// docker stats streams one line per container about every second; CPU
// time is integrated over the phase.
function statsSampler() {
	const cpuSeconds = {};
	const memPeak = {};
	const last = {};
	const proc = spawn("docker", ["stats", "--format", "{{json .}}"]);
	let buffer = "";
	proc.stdout.on("data", chunk => {
		buffer += chunk.toString().replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
		let i;
		while ((i = buffer.indexOf("\n")) >= 0) {
			const line = buffer.slice(0, i).trim();
			buffer = buffer.slice(i + 1);
			if (!line.startsWith("{")) continue;
			let s;
			try {
				s = JSON.parse(line);
			} catch {
				continue;
			}
			if (!s.Name?.startsWith(COMPOSE_PROJECT)) continue;
			const name = s.Name.replace(`${COMPOSE_PROJECT}-`, "").replace(/-\d+$/, "");
			const now = Date.now();
			const cpu = parseFloat(s.CPUPerc) / 100;
			if (last[name]) cpuSeconds[name] = (cpuSeconds[name] ?? 0) + cpu * ((now - last[name]) / 1000);
			last[name] = now;
			const mem = s.MemUsage.split("/")[0].trim();
			const mib = parseFloat(mem) * (mem.endsWith("GiB") ? 1024 : mem.endsWith("KiB") ? 1 / 1024 : 1);
			memPeak[name] = Math.max(memPeak[name] ?? 0, mib);
		}
	});
	return {
		stop() {
			proc.kill();
			return { cpuSeconds, memPeakMiB: memPeak };
		},
	};
}

async function meter(path) {
	const res = await fetch(METER + path, { method: path === "/__reset" ? "POST" : "GET" });
	return path === "/__stats" ? res.json() : null;
}

async function mailCount() {
	const res = await fetch(`${MAILHOG}/api/v2/messages?limit=1`).then(r => r.json()).catch(() => ({ total: 0 }));
	return res.total ?? 0;
}

async function runPhase(name, body) {
	console.log(`\n== ${name}`);
	tally = newTally();
	await meter("/__reset");
	const mailsBefore = await mailCount();
	const sampler = statsSampler();
	const started = Date.now();
	await body();
	await Promise.all([...pending]);
	const seconds = (Date.now() - started) / 1000;
	const docker = sampler.stop();
	const result = {
		phase: name,
		seconds,
		...tally,
		latency: Object.fromEntries(Object.entries(tally.latency).map(([k, v]) => [k, percentiles(v)])),
		dynamodb: await meter("/__stats"),
		mails: (await mailCount()) - mailsBefore,
		docker,
	};
	mkdirSync(OUT, { recursive: true });
	writeFileSync(`${OUT}/${name}.json`, JSON.stringify(result, null, 2));
	console.log(`   ${seconds.toFixed(0)}s, ${tally.pageviews} pageviews, actions ${JSON.stringify(tally.actions)}`);
	return result;
}

function percentiles(values) {
	if (!values.length) return null;
	const v = [...values].sort((a, b) => a - b);
	const at = q => Math.round(v[Math.min(v.length - 1, Math.floor(q * v.length))]);
	return { n: v.length, p50: at(0.5), p95: at(0.95), max: Math.round(v[v.length - 1]) };
}

// ---- browser helpers ----
let browser;
const members = new Map(); // i → { context, page }

async function member(i) {
	if (members.has(i)) return members.get(i);
	const mobile = i % 10 < 7; // most visits come from phones
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		locale: "ko-KR",
		viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 860 },
		isMobile: mobile,
		hasTouch: mobile,
		deviceScaleFactor: mobile ? 3 : 1,
		serviceWorkers: "block",
	});
	watch(context);
	const res = await context.request.post(`${BASE}/svc/auth/login`, { data: { email: email(i), password: PASSWORD } });
	if (!res.ok()) throw new Error(`login ${email(i)}: ${res.status()}`);
	const page = await context.newPage();
	page.setDefaultTimeout(20000);
	trackInflight(page);
	const m = { i, context, page, persona: persona(i) };
	members.set(i, m);
	return m;
}

// Requests in flight per page. A redirect hop gets its own request event
// but no finished event, so the hop it replaces is dropped; requests left
// over from a previous document are dropped on navigation.
function trackInflight(page) {
	const open = new Set();
	page.on("request", r => {
		const from = r.redirectedFrom();
		if (from) open.delete(from);
		open.add(r);
	});
	page.on("requestfinished", r => open.delete(r));
	page.on("requestfailed", r => open.delete(r));
	page.on("framenavigated", f => {
		if (f === page.mainFrame()) for (const r of open) if (r.isNavigationRequest() && r.frame() === f && r.url() !== f.url()) open.delete(r);
	});
	Object.defineProperty(page, "__inflight", { get: () => open.size });
}

// settle waits until the page has had no request in flight for a while
// (lazy images, client fetches), or gives up.
async function settle(page, idle = 500, max = 10000) {
	const end = Date.now() + max;
	let quietSince = Date.now();
	while (Date.now() < end) {
		if (page.__inflight > 0) quietSince = Date.now();
		else if (Date.now() - quietSince >= idle) return;
		await sleep(100);
	}
	if (process.env.SIM_DEBUG) console.log("   settle timeout, inflight", page.__inflight, page.url());
}

function pageType(path) {
	const p = path.split("?")[0];
	if (p === "/") return "home";
	const [, first, second] = p.split("/");
	if (second && ["product", "community", "housing", "jobs", "chat"].includes(first)) return `${first}-detail`;
	if (first === "search" && second) return "search-results";
	return first;
}

function pageview(path) {
	tally.pageviews++;
	count(tally.pages, pageType(path));
}

async function visit(m, path) {
	const t0 = Date.now();
	for (let attempt = 0; ; attempt++) {
		try {
			await m.page.goto(BASE + path, { waitUntil: "domcontentloaded" });
			break;
		} catch (e) {
			// A client-side navigation still running can abort the next one.
			if (attempt > 0) throw e;
			await sleep(500);
		}
	}
	pageview(path);
	await settle(m.page);
	if (process.env.SIM_DEBUG) console.log("   visit", path, Date.now() - t0, "ms");
}

// clickInto opens one of the links matching selector, like a member
// tapping a card (a client-side navigation).
async function clickInto(m, selector) {
	const links = m.page.locator(selector);
	const n = await links.count();
	if (!n) return false;
	const link = links.nth(rnd(Math.min(n, 12)));
	const href = await link.getAttribute("href");
	if (!href) return false;
	const target = new URL(href, BASE).pathname;
	await link.scrollIntoViewIfNeeded().catch(() => {});
	// A DOM click: Next's Link handles it as a client-side navigation, and
	// fixed bars over the link (the phone tab bar) cannot swallow it.
	await link.evaluate(a => a.click()).catch(() => {});
	await m.page.waitForURL(u => u.pathname === target, { timeout: 8000 }).catch(() => {});
	if (new URL(m.page.url()).pathname !== target) {
		if (process.env.SIM_DEBUG) console.log("   click did not navigate:", href, "from", m.page.url());
		return false;
	}
	pageview(target);
	await settle(m.page);
	return true;
}

async function scroll(m, screens = 3) {
	for (let k = 0; k < screens; k++) {
		await m.page.mouse.wheel(0, 800).catch(() => {});
		await sleep(200);
	}
	await settle(m.page);
}

async function gql(m, query, variables = {}) {
	return m.page.evaluate(
		async ({ query, variables }) => {
			const res = await fetch("/svc/api/graphql", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query, variables }),
			});
			return res.json();
		},
		{ query, variables },
	);
}

// Phone photos: 12 MP JPEGs drawn in the page (gradients, shapes and
// sensor-like noise), about the size a phone camera writes.
async function makePhotos(m) {
	return m.page.evaluate(async () => {
		if (window.__photos) return window.__photos.map(b => b.size);
		window.__photos = [];
		for (let k = 0; k < 4; k++) {
			const c = document.createElement("canvas");
			c.width = 3024;
			c.height = 4032;
			const g = c.getContext("2d");
			const grad = g.createLinearGradient(0, 0, c.width, c.height);
			grad.addColorStop(0, `hsl(${k * 80},40%,70%)`);
			grad.addColorStop(1, `hsl(${k * 80 + 140},35%,30%)`);
			g.fillStyle = grad;
			g.fillRect(0, 0, c.width, c.height);
			for (let s = 0; s < 60; s++) {
				g.fillStyle = `hsla(${Math.random() * 360},45%,${30 + Math.random() * 50}%,0.6)`;
				g.beginPath();
				g.arc(Math.random() * c.width, Math.random() * c.height, 80 + Math.random() * 500, 0, Math.PI * 2);
				g.fill();
			}
			const img = g.getImageData(0, 0, c.width, c.height);
			for (let p = 0; p < img.data.length; p += 4) {
				const n = (Math.random() - 0.5) * 22;
				img.data[p] += n;
				img.data[p + 1] += n;
				img.data[p + 2] += n;
			}
			g.putImageData(img, 0, 0);
			window.__photos.push(await new Promise(r => c.toBlob(r, "image/jpeg", 0.88)));
		}
		return window.__photos.map(b => b.size);
	});
}

async function upload(m, n) {
	await makePhotos(m);
	const res = await m.page.evaluate(async ({ n, raw }) => {
		// Like the site (libs/resizeImage.ts): long edge 1600 px, JPEG 0.85.
		const shrink = async blob => {
			const bitmap = await createImageBitmap(blob);
			const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
			const c = document.createElement("canvas");
			c.width = Math.round(bitmap.width * scale);
			c.height = Math.round(bitmap.height * scale);
			c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
			bitmap.close();
			return new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
		};
		const fd = new FormData();
		let bytes = 0;
		for (let k = 0; k < n; k++) {
			const photo = window.__photos[Math.floor(Math.random() * window.__photos.length)];
			const blob = raw ? photo : await shrink(photo);
			bytes += blob.size;
			fd.append("image", blob, `IMG_${Date.now()}_${k}.jpg`);
		}
		const r = await fetch("/svc/api/upload", { method: "POST", body: fd, credentials: "include" });
		return { status: r.status, body: await r.json().catch(() => null), bytes };
	}, { n, raw: args["raw-upload"] === "true" });
	if (res.status !== 200) throw new Error(`upload ${res.status}`);
	tally.uploads.files += n;
	tally.uploads.bytes += res.bytes;
	// What S3 holds: the stored photos (the server may re-encode them) and
	// their thumbnails.
	tally.uploads.storedBytes = (tally.uploads.storedBytes ?? 0) + await m.page.evaluate(async urls => {
		let total = 0;
		for (const u of urls) total += Number((await fetch(u, { method: "HEAD" })).headers.get("content-length") ?? 0);
		return total;
	}, [...res.body.urls, ...(res.body.thumbs ?? [])]);
	return res.body.urls;
}

// ---- actions (the same API calls the site makes) ----
async function createProduct(m) {
	const [name, category, price] = pick(PRODUCTS);
	const [lat, lng] = pick(POINTS);
	const images = await upload(m, 1 + rnd(4));
	const r = await gql(
		m,
		`mutation($n: String!, $d: String!, $p: Float!, $c: String!, $i: [String!], $l: String!, $lat: Float, $lng: Float) {
			createProduct(ProductName: $n, ProductDescription: $d, ProductPrice: $p, ProductCategory: $c, ProductImage: $i, PreferedLocation: $l, ProductRegion: "파리", Latitude: $lat, Longitude: $lng, ExactLocation: false) { ProductId } }`,
		{ n: `${name} ${rnd(100)}`, d: "상태 좋아요. 직거래 선호합니다. 메시지 주세요.", p: price + rnd(20), c: category, i: images, l: "파리", lat, lng },
	);
	count(tally.actions, r.errors ? `createProduct-error: ${r.errors[0]?.message}` : "createProduct");
	return r.data?.createProduct?.ProductId;
}

async function createPost(m) {
	const type = chance(0.5) ? "qna" : "free";
	const r = await gql(m, `mutation($in: PostInput!) { createPost(Input: $in) { PostId } }`, {
		in: {
			Type: type, Topic: pick(POST_TOPICS[type]), City: "파리", Anonymous: chance(0.2),
			Title: `${type === "qna" ? "질문" : "이야기"} ${m.i}-${rnd(100000)}`,
			Body: "파리에 온 지 얼마 안 됐는데 다들 어떻게 하셨는지 궁금해요. 경험 나눠주시면 감사하겠습니다!",
		},
	});
	count(tally.actions, r.errors ? `createPost-error: ${r.errors[0]?.message}` : "createPost");
	return r.data?.createPost?.PostId;
}

async function createListing(m) {
	const [lat, lng] = pick(POINTS);
	const housing = chance(0.6);
	const input = housing
		? {
			Type: "housing", Title: `15구 쉐어 방 ${rnd(1000)}`, Body: "역에서 5분, 조용한 집이에요.", Latitude: lat, Longitude: lng,
			Images: await upload(m, 2 + rnd(3)),
			Housing: { Mode: "offer", Kind: "쉐어", Rent: 600 + rnd(500), Deposit: 1000, Caf: chance(0.6), AvailableFrom: "2026-12-01" },
		}
		: {
			Type: "job", Title: `한식당 주말 홀 ${rnd(1000)}`, Body: "주말 점심, 경험자 우대합니다.", Latitude: lat, Longitude: lng, ExactLocation: false,
			Job: { Mode: "hiring", Sector: "식당·카페", Employment: "알바", WageType: "hourly", Wage: 12.5, PermitRequired: true },
			Contact: { Phone: "06 12 34 56 78" },
		};
	const r = await gql(m, `mutation($in: ListingInput!) { createListing(Input: $in, Acknowledge: true) { Post { PostId } } }`, { in: input });
	count(tally.actions, r.errors ? `createListing-error: ${r.errors[0]?.message}` : "createListing");
}

const postIdFromUrl = m => new URL(m.page.url()).pathname.split("/")[2];

async function commentHere(m) {
	const r = await gql(m, `mutation($p: String!, $b: String!) { createComment(PostId: $p, Body: $b) { CommentId } }`, {
		p: postIdFromUrl(m), b: pick(["저도 궁금했어요!", "구청에 먼저 가보세요. 저는 2주 걸렸어요.", "좋은 정보 감사합니다", "쪽지 드렸어요"]),
	});
	count(tally.actions, r.errors ? "comment-error" : "comment");
}

async function likeHere(m) {
	const r = await gql(m, `mutation($p: String!) { likePost(PostId: $p, On: true) { PostId } }`, { p: postIdFromUrl(m) });
	count(tally.actions, r.errors ? "like-error" : "like");
}

async function favoriteHere(m) {
	const id = postIdFromUrl(m);
	const status = await m.page.evaluate(async id => (await fetch(`/svc/api/favorites/${id}`, { method: "POST", credentials: "include" })).status, id);
	count(tally.actions, status < 300 ? "favorite" : "favorite-error");
}

// chatHere opens (or reuses) the room about this product, sends a few
// messages over the websocket like the chat page, then shows the room.
async function chatHere(m) {
	const productId = postIdFromUrl(m);
	const chatId = await m.page.evaluate(async id => {
		const res = await fetch(`/svc/chat/room/product/${id}`, { credentials: "include" });
		if (!res.ok) return null;
		const room = await res.json();
		return room.ChatId ?? null;
	}, productId);
	if (!chatId) return count(tally.actions, "chat-skipped");
	const sent = await m.page.evaluate(async ({ chatId, n }) => {
		const ws = new WebSocket(`${location.origin.replace("http", "ws")}/svc/chat/ws/${chatId}`);
		await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });
		for (let k = 0; k < n; k++) {
			ws.send(JSON.stringify({ Message: ["안녕하세요, 아직 판매 중인가요?", "내일 저녁에 거래 가능할까요?", "네 좋아요!", "샤틀레 역 어떠세요?"][k % 4] }));
			await new Promise(r => setTimeout(r, 300));
		}
		ws.close();
		return n;
	}, { chatId, n: 2 + rnd(3) }).catch(() => 0);
	count(tally.actions, "chatMessage", sent);
	await visit(m, `/chat/${chatId}`);
}

async function searchFor(m) {
	const box = m.page.locator('input[type="search"]').first();
	if (!(await box.count()) || !(await box.isVisible().catch(() => false))) {
		await visit(m, "/search");
	}
	const input = m.page.locator('input[type="search"]').first();
	if (!(await input.count())) return;
	const q = pick(QUERIES);
	await input.click().catch(() => {});
	await input.pressSequentially(q, { delay: 140 }).catch(() => {});
	await settle(m.page, 300);
	await input.press("Enter").catch(() => {});
	await m.page.waitForURL(u => u.pathname.startsWith("/search/"), { timeout: 15000 }).catch(() => {});
	pageview("/search/q");
	count(tally.actions, "search");
	await settle(m.page);
}

// Background polling of the bell (every 60 s while a page is open), for
// the time a real visit would last; the simulation itself moves faster.
async function poll(m, seconds) {
	for (let k = 0; k < Math.floor(seconds / 60); k++) {
		await gql(m, "{ unreadCount }");
		count(tally.actions, "poll");
	}
}

// ---- sessions ----
const NOT_WRITE = ':not([href$="/write"])';

async function session(m, { thinkMs = [150, 500] } = {}) {
	const t0 = tally.pageviews;
	const think = () => sleep(between(...thinkMs));
	const active = m.persona !== "lurker";

	await visit(m, chance(0.15) ? "/community" : "/");
	await scroll(m, 2);
	await think();

	// Second-hand: open a few products.
	if (chance(0.75)) {
		if (chance(0.4)) {
			await visit(m, "/search");
			await scroll(m, 3);
		}
		for (let k = 0; k < 1 + rnd(3); k++) {
			if (!(await clickInto(m, 'a[href^="/product/"]'))) break;
			await scroll(m, 1);
			if (active && chance(0.25)) await favoriteHere(m);
			if (active && chance(0.12)) await chatHere(m);
			await think();
			await m.page.goBack().catch(() => {});
			await settle(m.page);
		}
	}
	if (active && chance(0.5)) {
		await searchFor(m);
		if (await clickInto(m, 'a[href^="/product/"]')) await think();
	}

	// Community.
	if (chance(0.6)) {
		await visit(m, "/community");
		await scroll(m, 2);
		for (let k = 0; k < 1 + rnd(3); k++) {
			if (!(await clickInto(m, `a[href^="/community/"]${NOT_WRITE}`))) break;
			await scroll(m, 2);
			if (active && chance(0.35)) await likeHere(m);
			if (active && chance(0.3)) await commentHere(m);
			await think();
			await m.page.goBack().catch(() => {});
			await settle(m.page);
		}
	}

	// Housing or jobs.
	if (chance(0.35)) {
		const section = chance(0.6) ? "housing" : "jobs";
		await visit(m, `/${section}`);
		await scroll(m, 2);
		if (await clickInto(m, `a[href^="/${section}/"]${NOT_WRITE}`)) await think();
	}

	if (active && chance(0.4)) await visit(m, "/notifications");
	if (m.persona === "poster") {
		if (chance(0.35)) await createProduct(m);
		if (chance(0.35)) await createPost(m);
		if (chance(0.08)) await createListing(m);
	} else if (m.persona === "active" && chance(0.08)) {
		await createPost(m);
	}

	// A real visit lasts about 20 s per page.
	await poll(m, (tally.pageviews - t0) * between(12, 30));
	count(tally.actions, "session");
}

// ---- phases ----
async function accounts() {
	const run = promisify(execFile);
	const ids = Array.from({ length: USERS }, (_, k) => k + 1);
	for (let k = 0; k < ids.length; k += 6) {
		await Promise.all(
			ids.slice(k, k + 6).map(i =>
				run("scripts/beta-sim/run.sh", ["exec", "-T", "loginserver", "/main", "demo-account", email(i), PASSWORD, nickname(i)]),
			),
		);
	}
	console.log(`   ${USERS} members`);
}

// content: what a beta holds after its first weeks, written through the
// APIs by the members who post.
async function content() {
	const posters = Array.from({ length: USERS }, (_, k) => k + 1).filter(i => persona(i) !== "lurker");
	const jobs = [];
	for (let k = 0; k < Number(args.products ?? 200); k++) jobs.push(m => createProduct(m));
	for (let k = 0; k < Number(args.posts ?? 120); k++) jobs.push(m => createPost(m));
	for (let k = 0; k < Number(args.listings ?? 30); k++) jobs.push(m => createListing(m));
	jobs.sort(() => rand() - 0.5);
	let next = 0;
	await Promise.all(
		Array.from({ length: PARALLEL }, async () => {
			while (next < jobs.length) {
				const job = jobs[next++];
				const m = await member(pick(posters));
				if (m.page.url() === "about:blank") await visit(m, "/");
				await job(m).catch(e => count(tally.actions, `error: ${String(e.message).slice(0, 60)}`));
			}
		}),
	);
	// Comments and likes on the posts, from members reading them.
	const readers = Array.from({ length: USERS }, (_, k) => k + 1);
	const comments = Number(args.comments ?? 300);
	let done = 0;
	await Promise.all(
		Array.from({ length: PARALLEL }, async () => {
			while (done < comments) {
				done++;
				const m = await member(pick(readers));
				await visit(m, "/community");
				if (await clickInto(m, `a[href^="/community/"]${NOT_WRITE}`)) {
					await commentHere(m);
					if (chance(0.5)) await likeHere(m);
				}
			}
		}),
	);
}

// beta: DAYS days of browsing. Each day about 40% of members come by,
// for one to three visits.
async function beta() {
	const visits = [];
	for (let d = 0; d < DAYS; d++) {
		for (let i = 1; i <= USERS; i++) {
			if (!chance(0.4)) continue;
			const n = persona(i) === "lurker" ? 1 + rnd(2) : 1 + rnd(3);
			for (let k = 0; k < n; k++) visits.push(i);
		}
	}
	visits.sort(() => rand() - 0.5);
	console.log(`   ${visits.length} visits`);
	let next = 0;
	await Promise.all(
		Array.from({ length: PARALLEL }, async () => {
			while (next < visits.length) {
				const i = visits[next++];
				const m = await member(i);
				await session(m).catch(e => count(tally.actions, `error: ${String(e.message).slice(0, 60)}`));
				if (next % 25 === 0) process.stdout.write(`   ${next}/${visits.length}\r`);
			}
		}),
	);
}

// load: back-to-back visits without think time at rising parallelism,
// to see where the 2 vCPU host stops keeping up.
async function load() {
	const levels = (args.levels ?? "2,4,8,16").split(",").map(Number);
	const seconds = Number(args.levelSeconds ?? 60);
	const out = [];
	for (const level of levels) {
		const r = await runPhase(`load-${level}`, async () => {
			const end = Date.now() + seconds * 1000;
			await Promise.all(
				Array.from({ length: level }, async (_, w) => {
					while (Date.now() < end) {
						const m = await member(1 + ((w * 7 + rnd(USERS)) % USERS));
						await session(m, { thinkMs: [0, 50] }).catch(() => {});
					}
				}),
			);
		});
		out.push({ level, pageviewsPerSecond: r.pageviews / r.seconds, latency: r.latency, cpuSeconds: r.docker.cpuSeconds, seconds: r.seconds });
	}
	writeFileSync(`${OUT}/load.json`, JSON.stringify(out, null, 2));
}

browser = await chromium.launch({
	executablePath: process.env.CHROMIUM_PATH || undefined,
	// Only the rehearsal is reachable: no OpenStreetMap tiles or other
	// public services get simulated traffic.
	args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"],
});
try {
	if (PHASES.includes("accounts")) await runPhase("accounts", accounts);
	if (PHASES.includes("content")) await runPhase("content", content);
	// What the stack uses doing nothing (Elasticsearch, timers), so cost.mjs
	// can tell it from what visits cost.
	if (PHASES.includes("idle")) await runPhase("idle", () => sleep(Number(args.idleSeconds ?? 90) * 1000));
	if (PHASES.includes("beta")) await runPhase("beta", beta);
	if (PHASES.includes("load")) await load();
} finally {
	await browser.close();
}
