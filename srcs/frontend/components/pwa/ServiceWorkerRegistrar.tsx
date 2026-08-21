'use client';

import { useEffect } from "react";

// Registers the service worker. Browsers only allow this on HTTPS or
// localhost, so opening the dev server through a LAN IP silently skips it.
export const ServiceWorkerRegistrar = () => {
	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;
		navigator.serviceWorker.register("/sw.js").catch(() => {
			// Registration failures must not break the page.
		});
	}, []);

	return null;
};
