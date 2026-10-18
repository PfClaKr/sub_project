// The home's "프랑스에 막 왔다면" checklist can be dismissed for good.
// The choice lives in localStorage (the server never needs it) and is
// applied before the first
// paint by ARRIVAL_PREPAINT, which marks <html data-arrival-hidden>;
// globalStyles then hides every [data-arrival] element, so a member who
// dismissed it never sees it flash.

export const ARRIVAL_HIDDEN_KEY = "itnyang.arrival.hidden";

export const ARRIVAL_PREPAINT = `try{if(localStorage.getItem(${JSON.stringify(ARRIVAL_HIDDEN_KEY)}))document.documentElement.setAttribute("data-arrival-hidden","")}catch(e){}`;

export function isArrivalHidden(): boolean {
	try {
		return !!localStorage.getItem(ARRIVAL_HIDDEN_KEY);
	} catch {
		return false;
	}
}

export function setArrivalHidden(hidden: boolean): void {
	try {
		if (hidden) localStorage.setItem(ARRIVAL_HIDDEN_KEY, "1");
		else localStorage.removeItem(ARRIVAL_HIDDEN_KEY);
	} catch {
		// storage unavailable: hidden for this page only
	}
	document.documentElement.toggleAttribute("data-arrival-hidden", hidden);
}
