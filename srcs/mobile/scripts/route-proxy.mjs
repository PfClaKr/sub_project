// iOS screenshots (CI): Safari's inspector protocol cannot be driven from
// the runner, so the app is pointed at this proxy and relaunched once per
// screen. GET / redirects to the path in the ROUTE file; everything else
// is passed to the Next.js server. Same host for the whole session, so
// cookies and navigation behave as on the real site.
//
//   node scripts/route-proxy.mjs <port> <target> <route file>
import http from "node:http";
import { readFileSync } from "node:fs";

const [port = "4000", target = "http://localhost:3000", routeFile = "route.txt"] = process.argv.slice(2);
const upstream = new URL(target);

http.createServer((req, res) => {
	if (req.method === "GET" && req.url === "/") {
		let route = "/";
		try {
			route = readFileSync(routeFile, "utf8").trim() || "/";
		} catch {
			// no file: home
		}
		if (route !== "/") {
			res.writeHead(302, { Location: route, "Cache-Control": "no-store" });
			res.end();
			return;
		}
	}
	const proxied = http.request(
		{ hostname: upstream.hostname, port: upstream.port, path: req.url, method: req.method, headers: { ...req.headers, host: upstream.host } },
		upstreamRes => {
			res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
			upstreamRes.pipe(res);
		},
	);
	proxied.on("error", () => {
		res.writeHead(502);
		res.end();
	});
	req.pipe(proxied);
}).listen(Number(port), () => console.log(`route proxy on :${port} -> ${target}`));
