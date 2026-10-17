import { afterEach, describe, expect, it, vi } from "vitest";

describe("chatSocketUrl", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		vi.unstubAllGlobals();
		vi.resetModules();
	});

	it("turns an absolute http URL into ws", async () => {
		vi.stubGlobal("window", { location: { origin: "https://itnyang.fr" } });
		vi.stubEnv("NEXT_PUBLIC_CHAT_URL", "http://localhost:9090");
		const { chatSocketUrl } = await import("./config");
		expect(chatSocketUrl("/ws/abc")).toBe("ws://localhost:9090/ws/abc");
	});

	it("resolves a same-origin path against the page", async () => {
		vi.stubGlobal("window", { location: { origin: "https://itnyang.fr" } });
		vi.stubEnv("NEXT_PUBLIC_CHAT_URL", "/svc/chat");
		const { chatSocketUrl } = await import("./config");
		expect(chatSocketUrl("/ws/abc")).toBe("wss://itnyang.fr/svc/chat/ws/abc");
	});
});
