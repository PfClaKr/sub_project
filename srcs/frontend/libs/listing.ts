import { DEALS, LISTING_MODES, type ListingType } from "@/libs/constants";
import { formatPrice } from "@/libs/format";
import type { HousingInfo, JobInfo, Post } from "@/libs/types";

export const LISTING_PATH: Record<ListingType, string> = { housing: "/housing", job: "/jobs" };
export const LISTING_LABEL: Record<ListingType, string> = { housing: "집", job: "알바" };

// Explanations for the warning codes returned by createListing.
export const WARNING_TEXT: Record<string, { title: string; text: string }> = {
	contact: {
		title: "연락처나 메신저 아이디가 들어 있어요",
		text: "카톡·텔레그램 같은 외부 연락은 사기의 가장 흔한 시작이에요. 잇냥 채팅으로 대화하면 기록이 남아 문제가 생겼을 때 신고할 수 있어요.",
	},
	prepay: {
		title: "선입금을 요구하는 표현이 있어요",
		text: "집을 보거나 직접 만나기 전에 보증금·예약금을 보내라는 글은 사기일 가능성이 높아요. 이런 글은 운영진이 먼저 확인해요.",
	},
	low_wage: {
		title: "시급이 최저임금(SMIC)보다 낮아요",
		text: "프랑스 최저임금보다 낮은 시급은 불법이에요. 금액을 다시 확인해주세요.",
	},
};

export function warningText(code: string) {
	return WARNING_TEXT[code] ?? { title: "확인이 필요한 내용이 있어요", text: "글 내용을 다시 확인해주세요." };
}

export function modeLabel(type: ListingType, mode?: string): string {
	return (LISTING_MODES[type] as readonly { value: string; label: string }[]).find(m => m.value === mode)?.label ?? "";
}

export function dealLabel(deal?: string): string {
	return DEALS.find(d => d.value === deal)?.label ?? "";
}

// "€750/월 · 관리비 포함" (or "최대 €750/월" for someone looking).
export function rentLabel(h: HousingInfo): string {
	const price = `${formatPrice(h.Rent)}/월`;
	const base = h.Mode === "seek" ? `최대 ${price}` : price;
	return h.ChargesIncluded ? `${base} · 관리비 포함` : base;
}

export function wageLabel(j: JobInfo): string {
	if (j.WageType === "negotiable" || !j.Wage) return "급여 협의";
	return j.WageType === "hourly" ? `시급 ${formatPrice(j.Wage)}` : `월 ${formatPrice(j.Wage)}`;
}

// "9월 1일부터" from YYYY-MM-DD, "지금 바로" when it is today or past.
export function moveInLabel(date: string | undefined, today = new Date()): string {
	if (!date) return "";
	const [y, m, d] = date.split("-").map(Number);
	if (!y || !m || !d) return "";
	const day = Date.UTC(y, m - 1, d);
	const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
	if (day <= now) return "바로 입주";
	return y === today.getFullYear() ? `${m}월 ${d}일부터` : `${y}년 ${m}월 ${d}일부터`;
}

const DAY = 86_400_000;

// Expiry state for the owner's controls. extendable mirrors the server
// (7 days before expiry, or once expired).
export function expiryInfo(post: Pick<Post, "ExpiresAt" | "Status">, now = Date.now()) {
	const left = (post.ExpiresAt ?? 0) - now;
	const expired = post.Status === "expired" || left <= 0;
	return {
		expired,
		daysLeft: expired ? 0 : Math.ceil(left / DAY),
		extendable: expired || left <= 7 * DAY,
	};
}

// URL state of the housing/job boards.
export type ListingParams = {
	mode?: string;
	kind?: string; // housing kind or job sector
	q?: string;
	sort?: string;
	page?: number;
	max?: number; // max rent
	by?: string; // move-in by (YYYY-MM-DD)
	furnished?: boolean;
	caf?: boolean;
	pets?: boolean;
	minwage?: number;
	permitfree?: boolean;
	employment?: string;
	// Place filter, same keys as the product search.
	area?: string;
	place?: string;
	lat?: number;
	lng?: number;
	km?: number;
};

const SORTS: Record<ListingType, string[]> = {
	housing: ["newest", "rent_asc", "available", "distance"],
	job: ["newest", "wage_desc", "distance"],
};

export function parseListingParams(type: ListingType, sp: { get(name: string): string | null }): ListingParams {
	const out: ListingParams = {};
	const str = (k: string) => sp.get(k)?.trim() || undefined;
	const pos = (k: string) => {
		const n = Number(sp.get(k));
		return Number.isFinite(n) && n > 0 ? n : undefined;
	};
	const flag = (k: string) => (sp.get(k) === "1" ? true : undefined);
	const mode = str("mode");
	if (mode && (LISTING_MODES[type] as readonly { value: string }[]).some(m => m.value === mode)) out.mode = mode;
	out.kind = str("kind");
	out.q = str("q")?.slice(0, 100);
	const sort = str("sort");
	if (sort && SORTS[type].includes(sort)) out.sort = sort;
	const page = pos("page");
	if (page && Number.isInteger(page) && page > 1) out.page = page;
	if (type === "housing") {
		out.max = pos("max");
		const by = str("by");
		if (by && /^\d{4}-\d{2}-\d{2}$/.test(by)) out.by = by;
		out.furnished = flag("furnished");
		out.caf = flag("caf");
		out.pets = flag("pets");
	} else {
		out.minwage = pos("minwage");
		out.permitfree = flag("permitfree");
		out.employment = str("employment");
	}
	out.area = str("area");
	out.place = str("place");
	const lat = Number(sp.get("lat"));
	const lng = Number(sp.get("lng"));
	if (sp.get("lat") && sp.get("lng") && Number.isFinite(lat) && Number.isFinite(lng)) {
		out.lat = lat;
		out.lng = lng;
	}
	out.km = pos("km");
	for (const k of Object.keys(out) as (keyof ListingParams)[]) if (out[k] === undefined) delete out[k];
	return out;
}

// listingHref keeps the current filters, applies the change and goes back
// to page 1 unless the page itself changed.
export function listingHref(type: ListingType, current: ListingParams, change: Partial<ListingParams>): string {
	const next: ListingParams = { ...current, ...change };
	if (!("page" in change)) delete next.page;
	const q = new URLSearchParams();
	for (const [k, v] of Object.entries(next)) {
		if (v === undefined || v === "" || v === false || (k === "page" && v === 1)) continue;
		q.set(k, v === true ? "1" : String(v));
	}
	const s = q.toString();
	return s ? `${LISTING_PATH[type]}?${s}` : LISTING_PATH[type];
}

// GraphQL variables for the listings query.
export function listingVariables(type: ListingType, p: ListingParams, city: string) {
	const vars: Record<string, unknown> = {
		type, city: city || null, q: p.q ?? null, sort: p.sort ?? null, page: p.page ?? 1,
		area: null, lat: null, lng: null, km: null,
	};
	if (p.area && !p.km) {
		vars.area = p.area;
	} else if (p.lat !== undefined && p.lng !== undefined && p.km) {
		vars.lat = p.lat;
		vars.lng = p.lng;
		vars.km = p.km;
	}
	if (type === "housing") {
		vars.housing = {
			Mode: p.mode ?? null, Kinds: p.kind ? [p.kind] : null, MaxRent: p.max ?? null, AvailableBy: p.by ?? null,
			Furnished: !!p.furnished, Caf: !!p.caf, Pets: !!p.pets,
		};
	} else {
		vars.job = {
			Mode: p.mode ?? null, Sectors: p.kind ? [p.kind] : null, Employment: p.employment ? [p.employment] : null,
			MinWage: p.minwage ?? null, PermitFree: !!p.permitfree,
		};
	}
	return vars;
}
