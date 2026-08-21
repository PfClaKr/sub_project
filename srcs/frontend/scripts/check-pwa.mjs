// Verifies the built app serves a valid PWA: manifest fields, icons and
// the service worker. Run against a started Next.js server.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const failures = [];
const check = (ok, label) => {
	if (!ok) failures.push(label);
};

async function main() {
	const manifestRes = await fetch(`${BASE}/manifest.webmanifest`);
	check(manifestRes.ok, "manifest is not served");
	const manifest = await manifestRes.json();

	check(Boolean(manifest.name), "manifest.name is missing");
	check(Boolean(manifest.short_name), "manifest.short_name is missing");
	check(manifest.start_url === "/", "manifest.start_url must be /");
	check(manifest.display === "standalone", "manifest.display must be standalone");
	check(Boolean(manifest.theme_color), "manifest.theme_color is missing");

	// Installability needs at least a 192px and a 512px icon.
	const sizes = (manifest.icons ?? []).map(icon => icon.sizes);
	check(sizes.includes("192x192"), "manifest is missing a 192x192 icon");
	check(sizes.includes("512x512"), "manifest is missing a 512x512 icon");
	check(
		(manifest.icons ?? []).some(icon => icon.purpose === "maskable"),
		"manifest is missing a maskable icon"
	);

	for (const icon of manifest.icons ?? []) {
		const res = await fetch(`${BASE}${icon.src}`);
		check(res.ok, `icon ${icon.src} is not served`);
		check(
			(res.headers.get("content-type") ?? "").includes("image/png"),
			`icon ${icon.src} is not a png`
		);
	}

	const sw = await fetch(`${BASE}/sw.js`);
	check(sw.ok, "sw.js is not served");
	check(
		(sw.headers.get("content-type") ?? "").includes("javascript"),
		"sw.js is not served as javascript"
	);

	const offline = await fetch(`${BASE}/offline`);
	check(offline.ok, "offline fallback page is not served");

	if (failures.length > 0) {
		console.error("PWA check failed:");
		failures.forEach(f => console.error(" -", f));
		process.exit(1);
	}
	console.log("PWA check passed");
}

main().catch(err => {
	console.error("PWA check errored:", err.message);
	process.exit(1);
});
