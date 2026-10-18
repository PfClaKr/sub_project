import { API_URL } from "@/libs/config";
import { libText } from "@/libs/libText";

// The VAPID public key arrives base64url encoded; PushManager wants bytes.
export function urlBase64ToUint8Array(base64: string): Uint8Array {
	const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(padded);
	return Uint8Array.from(raw, c => c.charCodeAt(0));
}

export type PushSupport = "supported" | "unsupported" | "needs-install";

// iOS Safari only allows web push for apps added to the home screen.
export function pushSupport(nav: { userAgent: string; standalone?: boolean } , hasPushManager: boolean, standaloneDisplay: boolean): PushSupport {
	const ios = /iPad|iPhone|iPod/.test(nav.userAgent);
	if (ios && !(nav.standalone || standaloneDisplay)) return "needs-install";
	return hasPushManager ? "supported" : "unsupported";
}

export function detectPushSupport(): PushSupport {
	if (typeof window === "undefined") return "unsupported";
	const nav = navigator as Navigator & { standalone?: boolean };
	return pushSupport(nav, "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
		window.matchMedia?.("(display-mode: standalone)").matches ?? false);
}

export async function currentSubscription(): Promise<PushSubscription | null> {
	if (!("serviceWorker" in navigator)) return null;
	const reg = await navigator.serviceWorker.getRegistration();
	return (await reg?.pushManager.getSubscription()) ?? null;
}

// enablePush asks for permission, subscribes this browser and registers
// it with the apiserver. Returns an error message or "".
export async function enablePush(): Promise<string> {
	const keyRes = await fetch(`${API_URL}/push/key`).then(r => r.json()).catch(() => null);
	if (!keyRes?.Enabled) return libText("pushNotReady");
	const permission = await Notification.requestPermission();
	if (permission !== "granted") return libText("pushBlocked");
	const reg = await navigator.serviceWorker.ready;
	const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyRes.PublicKey) });
	const res = await fetch(`${API_URL}/push/subscription`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(sub.toJSON()),
	});
	return res.ok ? "" : libText("pushRegister");
}

export async function disablePush(): Promise<void> {
	const sub = await currentSubscription();
	if (!sub) return;
	await fetch(`${API_URL}/push/subscription`, {
		method: "DELETE",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ endpoint: sub.endpoint }),
	}).catch(() => {});
	await sub.unsubscribe();
}
