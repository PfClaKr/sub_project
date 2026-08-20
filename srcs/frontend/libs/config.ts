// Centralized backend endpoints.
// Server-side code (server components / SSR) reaches services over the
// compose network; browser code goes through the host-published ports.
// Every value can be overridden by env so moving to a cloud host needs
// no code change.

const isServer = typeof window === "undefined";

export const API_URL = isServer
	? process.env.API_INTERNAL_URL ?? "http://apiserver:8080"
	: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export const LOGIN_URL = isServer
	? process.env.LOGIN_INTERNAL_URL ?? "http://loginserver:7070"
	: process.env.NEXT_PUBLIC_LOGIN_URL ?? "http://localhost:7070";

export const CHAT_URL = isServer
	? process.env.CHAT_INTERNAL_URL ?? "http://chatserver:9090"
	: process.env.NEXT_PUBLIC_CHAT_URL ?? "http://localhost:9090";

export const GRAPHQL_URL = `${API_URL}/graphql`;
