'use client';

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { gql } from "@/libs/graphql";
import { useSession } from "@/libs/session";

type NotificationState = {
	unread: number;
	refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationState>({ unread: 0, refresh: async () => {} });

// How often the header badge asks for the unread count. It also refreshes
// when the window regains focus, so a returning visitor sees it at once.
const POLL_MS = 60_000;

// NotificationProvider keeps the unread count for the header badge and
// the notifications page (which refreshes it after marking read).
export function NotificationProvider({ children }: { children: React.ReactNode }) {
	const { session } = useSession();
	const [unread, setUnread] = useState(0);

	const refresh = useCallback(async () => {
		if (!session) {
			setUnread(0);
			return;
		}
		const { data } = await gql<{ unreadCount: number }>(`{ unreadCount }`);
		if (data) setUnread(data.unreadCount ?? 0);
	}, [session]);

	useEffect(() => {
		refresh();
		if (!session) return;
		const timer = window.setInterval(() => {
			if (document.visibilityState === "visible") refresh();
		}, POLL_MS);
		window.addEventListener("focus", refresh);
		return () => {
			window.clearInterval(timer);
			window.removeEventListener("focus", refresh);
		};
	}, [session, refresh]);

	return <NotificationContext.Provider value={{ unread, refresh }}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationState {
	return useContext(NotificationContext);
}
