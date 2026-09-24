'use client';

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { LOGIN_URL } from "@/libs/config";
import type { Session } from "@/libs/types";

type SessionState = {
	session: Session | null;
	// true until the first whoami answer arrives.
	loading: boolean;
	refresh: () => Promise<Session | null>;
	logout: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

// SessionProvider fetches /whoami once and shares the result, instead of
// every component asking the loginserver on its own.
export function SessionProvider({ children }: { children: React.ReactNode }) {
	const [session, setSession] = useState<Session | null>(null);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		let next: Session | null = null;
		try {
			const res = await fetch(`${LOGIN_URL}/whoami`, { credentials: "include" });
			next = res.ok ? await res.json() : null;
		} catch {
			next = null;
		}
		setSession(next);
		setLoading(false);
		return next;
	}, []);

	const logout = useCallback(async () => {
		try {
			await fetch(`${LOGIN_URL}/logout`, { method: "POST", credentials: "include" });
		} finally {
			setSession(null);
		}
	}, []);

	useEffect(() => {
		refresh();
	}, [refresh]);

	return (
		<SessionContext.Provider value={{ session, loading, refresh, logout }}>
			{children}
		</SessionContext.Provider>
	);
}

export function useSession(): SessionState {
	const ctx = useContext(SessionContext);
	if (!ctx) throw new Error("useSession must be used inside SessionProvider");
	return ctx;
}
