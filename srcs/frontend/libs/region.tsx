'use client';

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { REGIONS } from "@/libs/constants";
import { useSession } from "@/libs/session";

type RegionState = {
	// "" means every region.
	city: string;
	setCity: (city: string) => void;
};

const RegionContext = createContext<RegionState>({ city: "", setCity: () => {} });

const STORAGE_KEY = "itnyang.region";

function stored(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

// RegionProvider holds the region filter shared by the hub and the
// boards. A choice is remembered in this browser; until one is made the
// member's residence is used, and visitors see every region.
export function RegionProvider({ children }: { children: React.ReactNode }) {
	const { session } = useSession();
	const [city, setCityState] = useState("");

	useEffect(() => {
		const saved = stored();
		if (saved !== null && (saved === "" || (REGIONS as readonly string[]).includes(saved))) {
			setCityState(saved);
		} else if (session?.Residence && (REGIONS as readonly string[]).includes(session.Residence)) {
			setCityState(session.Residence);
		}
	}, [session?.Residence]);

	const setCity = useCallback((next: string) => {
		setCityState(next);
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// Private mode: the choice lasts for this page only.
		}
	}, []);

	return <RegionContext.Provider value={{ city, setCity }}>{children}</RegionContext.Provider>;
}

export function useRegion(): RegionState {
	return useContext(RegionContext);
}
