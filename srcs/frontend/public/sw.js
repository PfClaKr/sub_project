// itnyang service worker.
// Network-first so the marketplace never serves stale listings;
// the cache only backs the offline fallback and static icons.

const CACHE = "itnyang-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", event => {
	event.waitUntil(
		caches.open(CACHE)
			.then(cache => cache.addAll(PRECACHE))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener("activate", event => {
	event.waitUntil(
		caches.keys()
			.then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", event => {
	const { request } = event;
	if (request.method !== "GET") return;

	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;
	// Dev server HMR must never be cached.
	if (url.pathname.startsWith("/_next/webpack-hmr")) return;

	// Page navigations: serve the offline page when the network is gone.
	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request).catch(() =>
				caches.match(OFFLINE_URL).then(res => res ?? Response.error())
			)
		);
		return;
	}

	// Icons: cache-first, they rarely change.
	if (url.pathname.startsWith("/icons/")) {
		event.respondWith(
			caches.match(request).then(cached =>
				cached ?? fetch(request).then(res => {
					const copy = res.clone();
					caches.open(CACHE).then(cache => cache.put(request, copy));
					return res;
				})
			)
		);
	}
});

// Web push: the apiserver sends {title, body, url, tag} (package/notify).
self.addEventListener("push", event => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { title: "잇냥", body: event.data ? event.data.text() : "" };
	}
	event.waitUntil(
		self.registration.showNotification(data.title || "잇냥", {
			body: data.body || "",
			icon: "/icons/icon-192.png",
			badge: "/icons/icon-192.png",
			tag: data.tag || undefined,
			data: { url: data.url || "/notifications" },
		})
	);
});

// Clicking opens the linked page, reusing an open tab when there is one.
self.addEventListener("notificationclick", event => {
	event.notification.close();
	const path = event.notification.data?.url || "/notifications";
	const target = new URL(path.startsWith("/") ? path : "/notifications", self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
			for (const client of list) {
				if (new URL(client.url).origin === self.location.origin && "focus" in client) {
					client.navigate(target);
					return client.focus();
				}
			}
			return self.clients.openWindow(target);
		})
	);
});
