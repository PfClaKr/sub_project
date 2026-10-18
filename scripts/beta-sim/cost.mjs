// Monthly AWS cost from a beta simulation (scripts/beta-sim/README.md).
//
// Reads <results>/beta.json (idle.json and load.json when present), turns
// it into averages per visit, and scales them to members per month. Prices
// are eu-west-3 (Paris) on-demand list prices in USD, checked October
// 2026; update PRICES when AWS changes them.
//
//   node scripts/beta-sim/cost.mjs [--results=scripts/beta-sim/results]
//        [--compare=<other results dir>]   side by side, e.g. before/after
//        [--cpuFactor=2]                   local core ÷ Lightsail vCPU
import { readFileSync, existsSync } from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, "").split("=")));

export const PRICES = {
	// Lightsail Linux bundles with IPv4 (docs: amazon-lightsail-bundles,
	// baseline-cpu-performance): price, vCPUs, memory GiB, sustained
	// baseline per vCPU, included transfer.
	lightsail: [
		{ name: "2GB", usd: 12, vcpu: 2, mem: 2, baseline: 0.2, transferTB: 3 },
		{ name: "4GB", usd: 24, vcpu: 2, mem: 4, baseline: 0.2, transferTB: 4 },
		{ name: "8GB", usd: 44, vcpu: 2, mem: 8, baseline: 0.3, transferTB: 5 },
		{ name: "16GB", usd: 84, vcpu: 4, mem: 16, baseline: 0.4, transferTB: 6 },
		{ name: "32GB", usd: 164, vcpu: 8, mem: 32, baseline: 0.4, transferTB: 7 },
	],
	lightsailOverGB: 0.09,
	dynamoWritePerMillion: 0.7423, // on-demand WRU, Paris
	dynamoReadPerMillion: 0.1487, // on-demand RRU, Paris
	dynamoStorageGB: 0.29715, // first 25 GB free
	s3StorageGB: 0.024,
	s3PutPer1000: 0.0053,
	s3GetPer1000: 0.00042,
	internetOutGB: 0.09, // after 100 GB/month free (all services together)
	internetFreeGB: 100,
	sesPer1000: 0.1,
	domainPerMonth: 10 / 12,
};

// Members per month and how often each comes by. The simulated beta has
// enthusiastic members (about 20 visits a month); a larger community
// visits less often. months: how long photos have been piling up.
const SCENARIOS = [
	{ name: "베타", members: 150, visits: 20, months: 1 },
	{ name: "초기", members: 1000, visits: 12, months: 6 },
	{ name: "성장", members: 5000, visits: 10, months: 12 },
	{ name: "확장", members: 20000, visits: 8, months: 18 },
];
const SERVER = ["caddy", "nextjs", "apiserver", "loginserver", "chatserver", "elasticsearch"];
// Evenings carry most visits: the busiest hour sees about three times
// the average rate.
const PEAK = 3;
// A Lightsail vCPU is assumed to do half the work of a core of the
// machine the simulation ran on (unknown hardware, so on the safe side).
const CPU_FACTOR = Number(args.cpuFactor ?? 2);

// Real DynamoDB bills at least 0.5 RRU per read call and 1 WRU per write
// call; DynamoDB Local reports 0 for empty results.
function units(phase) {
	let read = 0;
	let write = 0;
	for (const s of phase.dynamodb) {
		if (s.Write) write += Math.max(s.Units, s.Calls);
		else read += Math.max(s.Units, s.Calls * 0.5);
	}
	return { read, write };
}

const serverCpu = phase => SERVER.reduce((n, k) => n + (phase.docker.cpuSeconds[k] ?? 0), 0);

// analyze turns one results directory into per-visit figures and the
// monthly scenarios.
function analyze(dir) {
	const load = name => JSON.parse(readFileSync(`${dir}/${name}.json`, "utf8"));
	const beta = load("beta");
	const visits = beta.actions.session;
	const ddb = units(beta);
	// CPU the stack burns doing nothing (idle phase): a constant load on
	// the server, taken out of what the visits cost.
	const idle = existsSync(`${dir}/idle.json`) ? load("idle") : null;
	const idleVcpu = idle ? serverCpu(idle) / idle.seconds : 0;
	const bytes = keys => keys.reduce((n, k) => n + (beta.bytes[k] ?? 0), 0);

	const perVisit = {
		pageviews: beta.pageviews / visits,
		rru: ddb.read / visits,
		wru: ddb.write / visits,
		serverMB: bytes(["document", "rsc", "static", "api"]) / visits / 1e6,
		mediaMB: bytes(["media"]) / visits / 1e6,
		mediaRequests: (beta.requests.media ?? 0) / visits,
		cpuSeconds: Math.max(0, serverCpu(beta) - idleVcpu * beta.seconds) / visits,
		uploads: beta.uploads.files / visits,
		// Stored in S3 (photos as kept plus thumbnails); older results
		// only have what the browser sent.
		storedMB: (beta.uploads.storedBytes ?? beta.uploads.bytes) / visits / 1e6,
		mails: beta.mails / visits,
		notifications: (beta.dynamodb.find(s => s.Op === "PutItem" && s.Table === "Notifications")?.Calls ?? 0) / visits,
	};
	const memPeak = SERVER.reduce((n, k) => n + (beta.docker.memPeakMiB[k] ?? 0), 0);
	const loadLevels = existsSync(`${dir}/load.json`) ? load("load") : [];

	const monthly = s => {
		const v = s.members * s.visits;
		const mediaGB = (v * perVisit.mediaMB) / 1e3;
		const storedGB = (v * s.months * perVisit.storedMB) / 1e3;
		// Background jobs: the mail worker (a query a minute) and the
		// listing expiry scan of Posts every 30 minutes (posts grow).
		const posts = s.members * s.months * 2;
		const rru = v * perVisit.rru + 43200 * 0.5 + 1440 * Math.max(0.5, (posts * 1.5) / 4 / 2);
		const wru = v * perVisit.wru;
		// Notification digests plus sign-ups and password resets.
		const mails = v * Math.max(perVisit.mails, perVisit.notifications * 0.5) + s.members * 0.2;
		const visitVcpu = (v * perVisit.cpuSeconds * CPU_FACTOR) / (30 * 86400);
		const avgVcpu = visitVcpu + idleVcpu * CPU_FACTOR;
		const peakVcpu = visitVcpu * PEAK + idleVcpu * CPU_FACTOR;
		const plan =
			PRICES.lightsail.find(p => p.vcpu * p.baseline >= avgVcpu && p.vcpu * 0.7 >= peakVcpu && p.mem * 1024 * 0.85 >= memPeak + 250) ??
			PRICES.lightsail.at(-1);
		const serverGB = (v * perVisit.serverMB) / 1e3;
		const lines = {
			lightsail: plan.usd + Math.max(0, serverGB - plan.transferTB * 1000) * PRICES.lightsailOverGB,
			dynamodb: (rru / 1e6) * PRICES.dynamoReadPerMillion + (wru / 1e6) * PRICES.dynamoWritePerMillion,
			s3: storedGB * PRICES.s3StorageGB + ((v * perVisit.uploads * 2) / 1000) * PRICES.s3PutPer1000 + ((v * perVisit.mediaRequests) / 1000) * PRICES.s3GetPer1000,
			transfer: Math.max(0, mediaGB - PRICES.internetFreeGB) * PRICES.internetOutGB,
			ses: (mails / 1000) * PRICES.sesPer1000,
			domain: PRICES.domainPerMonth,
		};
		return {
			...s, visitsPerMonth: v, pageviews: Math.round(v * perVisit.pageviews), plan: plan.name, avgVcpu, peakVcpu,
			rru, wru, serverGB, mediaGB, storedGB, mails, lines, total: Object.values(lines).reduce((a, b) => a + b, 0),
		};
	};
	return { dir, beta, visits, perVisit, idleVcpu, memPeak, loadLevels, scenarios: SCENARIOS.map(monthly) };
}

const usd = n => (n < 0.01 ? "<$0.01" : `$${n.toFixed(n < 10 ? 2 : 0)}`);
const fmt = n => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(1));

function print(a) {
	console.log(`\n### ${a.dir}: 베타 ${a.beta.seconds.toFixed(0)}초, 방문 ${a.visits}회, 페이지뷰 ${a.beta.pageviews}`);
	console.log("방문 1회당:", Object.fromEntries(Object.entries(a.perVisit).map(([k, v]) => [k, +v.toFixed(3)])));
	console.log(`대기 중 서버 CPU ${a.idleVcpu.toFixed(3)} 코어, 서버 메모리 최대 합 ${a.memPeak.toFixed(0)} MiB`);
	for (const l of a.loadLevels) {
		const c = SERVER.reduce((n, k) => n + (l.cpuSeconds[k] ?? 0), 0);
		console.log(`  부하 동시 ${l.level}: ${l.pageviewsPerSecond.toFixed(2)} pv/s, 서버 CPU ${(c / l.seconds).toFixed(2)} 코어, 문서 p95 ${l.latency.document?.p95 ?? "-"} ms, RSC p95 ${l.latency.rsc?.p95 ?? "-"} ms, API p95 ${l.latency.api?.p95 ?? "-"} ms`);
	}
	for (const r of a.scenarios) {
		console.log(
			`${r.name} ${r.members}명: 방문 ${fmt(r.visitsPerMonth)}, PV ${fmt(r.pageviews)}, Lightsail ${r.plan} (평균 ${r.avgVcpu.toFixed(2)} / 피크 ${r.peakVcpu.toFixed(2)} vCPU)` +
				` | RRU ${fmt(r.rru)} WRU ${fmt(r.wru)} | 서버 전송 ${r.serverGB.toFixed(1)} GB, 사진 전송 ${r.mediaGB.toFixed(0)} GB, 사진 저장 ${r.storedGB.toFixed(1)} GB | 메일 ${fmt(r.mails)}`,
		);
		console.log("   ", Object.entries(r.lines).map(([k, v]) => `${k} ${usd(v)}`).join(", "), `→ 합계 ${usd(r.total)}/월`);
	}
}

const main = analyze(args.results ?? "scripts/beta-sim/results");
print(main);
if (args.compare) {
	const other = analyze(args.compare);
	print(other);
	console.log(`\n### 월 합계 비교: ${main.dir} → ${other.dir}`);
	main.scenarios.forEach((r, i) => {
		const o = other.scenarios[i];
		console.log(`${r.name} ${r.members}명: ${usd(r.total)} → ${usd(o.total)} (사진 전송 ${r.mediaGB.toFixed(0)} → ${o.mediaGB.toFixed(0)} GB, 사진 저장 ${r.storedGB.toFixed(1)} → ${o.storedGB.toFixed(1)} GB)`);
	});
}
