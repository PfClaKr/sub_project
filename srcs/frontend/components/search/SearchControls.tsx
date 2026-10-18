'use client';

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
import { LocateFixed, MapPin, SlidersHorizontal } from "lucide-react";
import { REGIONS } from "@/libs/constants";
import { Adorned, FieldLabel, TwoColumns } from "@/styles/styledForm";
import { PickerMap } from "@/components/map";
import { GhostButton, Muted } from "@/styles/styledUi";
import { FilterButton, PanelActions, Popover, PopoverPanel, Toolbar } from "@/styles/styledSearch";
import { MapBox, PlaceResults, PlaceSearch, RadiusChips } from "@/styles/styledLocation";
import {
	areaCenter, currentPosition, fetchArea, resolveArea, searchPlaces, SEARCH_DISTANCES,
	type Area, type LatLng, type Place,
} from "@/libs/geo";

// Labels: market.sort<Key>.
const SORTS = [
	{ value: "", key: "sortRelevance" },
	{ value: "newest", key: "sortNewest" },
	{ value: "price_asc", key: "sortPriceAsc" },
	{ value: "price_desc", key: "sortPriceDesc" },
	{ value: "distance", key: "sortDistance", needsPlace: true },
];

// Without a keyword there is no relevance: the default is newest.
const BROWSE_SORTS = [{ value: "", key: "sortNewest" }, ...SORTS.slice(2)];

// SearchControls edits the sort and the place filter through the URL
// (area, place, lat, lng, km), so results stay shareable and the server
// page runs the query. Like leboncoin's "Localisation" + "Rayon".
// browse: no keyword (the 중고 tab), so newest is the default order and
// the count is per page.
export function SearchControls({ total, browse = false }: { total: number; browse?: boolean }) {
	const t = useTranslations("market");
	const L = useLabels();
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();
	const [open, setOpen] = useState(false);
	const [filtersOpen, setFiltersOpen] = useState(false);
	const region = params.get("region") ?? "";
	const min = params.get("min") ?? "";
	const max = params.get("max") ?? "";
	const filterCount = [region, min, max].filter(Boolean).length;

	const areaId = params.get("area");
	const km = Number(params.get("km")) || 0;
	const placeName = params.get("place");
	const hasPlace = !!areaId || !!params.get("lat");
	const sort = params.get("sort") ?? "";

	const update = (changes: Record<string, string | null>) => {
		const next = new URLSearchParams(params.toString());
		for (const [k, v] of Object.entries(changes)) {
			if (v) next.set(k, v);
			else next.delete(k);
		}
		next.delete("page");
		const q = next.toString();
		router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
	};

	return (
		<Toolbar>
			{!browse && <Muted>{t("count", { count: total })}</Muted>}
			<span style={{ flex: 1 }} />
			<Popover>
				<FilterButton $on={filterCount > 0} onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}>
					<SlidersHorizontal size={16} /> {t("filters")}{filterCount > 0 ? ` ${filterCount}` : ""}
				</FilterButton>
				{filtersOpen && (
					<FilterPanel
						initial={{ region, min, max }}
						onClose={() => setFiltersOpen(false)}
						onApply={f => {
							setFiltersOpen(false);
							update({ region: f.region || null, min: f.min || null, max: f.max || null });
						}}
					/>
				)}
			</Popover>
			<Popover>
				<FilterButton $on={hasPlace} onClick={() => setOpen(o => !o)} aria-expanded={open}>
					<MapPin size={16} /> {hasPlace ? `${placeName ?? t("chosenPlace")} · ${L.distance(km)}` : t("setPlace")}
				</FilterButton>
				{open && (
					<LocationFilterPanel
						initial={hasPlace ? {
							areaId, km, name: placeName ?? "",
							center: params.get("lat") ? { lat: Number(params.get("lat")), lng: Number(params.get("lng")) } : null,
						} : null}
						onClose={() => setOpen(false)}
						onApply={f => {
							setOpen(false);
							if (f) {
								update({
									area: f.area?.AreaId ?? null,
									place: f.name,
									lat: f.center.lat.toFixed(5),
									lng: f.center.lng.toFixed(5),
									km: String(f.km),
									// Choosing a place usually means "closest first".
									sort: sort || "distance",
								});
							} else {
								update({ area: null, place: null, lat: null, lng: null, km: null, sort: sort === "distance" ? null : sort });
							}
						}}
					/>
				)}
			</Popover>
			<select aria-label={t("sort")} value={sort} onChange={e => update({ sort: e.target.value || null })}>
				{(browse ? BROWSE_SORTS : SORTS).filter(s => !s.needsPlace || hasPlace).map(s => (
					<option key={s.value} value={s.value}>{t(s.key)}</option>
				))}
			</select>
		</Toolbar>
	);
}

type Filters = { region: string; min: string; max: string };

// Region and price range, like the filters of the old search page.
function FilterPanel({ initial, onApply, onClose }: {
	initial: Filters;
	onApply: (f: Filters) => void;
	onClose: () => void;
}) {
	const t = useTranslations("market");
	const c = useTranslations("common");
	const L = useLabels();
	const [f, setF] = useState(initial);
	const invalid = !!f.min && !!f.max && Number(f.min) > Number(f.max);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<PopoverPanel role="dialog" aria-label={t("filters")}>
			<strong>{t("filters")}</strong>
			<FieldLabel>{c("region")}
				<select value={f.region} onChange={e => setF({ ...f, region: e.target.value })}>
					<option value="">{t("all")}</option>
					{REGIONS.map(r => <option key={r} value={r}>{L.enum("region", r)}</option>)}
				</select>
			</FieldLabel>
			<TwoColumns>
				<FieldLabel>{t("minPrice")}
					<Adorned><span aria-hidden>€</span>
						<input type="number" min={0} inputMode="decimal" placeholder="0" value={f.min} onChange={e => setF({ ...f, min: e.target.value })} />
					</Adorned>
				</FieldLabel>
				<FieldLabel>{t("maxPrice")}
					<Adorned><span aria-hidden>€</span>
						<input type="number" min={0} inputMode="decimal" placeholder={t("noLimit")} value={f.max} onChange={e => setF({ ...f, max: e.target.value })} />
					</Adorned>
				</FieldLabel>
			</TwoColumns>
			{invalid && <Muted role="alert">{t("minOverMax")}</Muted>}
			<PanelActions>
				<GhostButton type="button" onClick={() => onApply({ region: "", min: "", max: "" })}>{t("reset")}</GhostButton>
				<button type="button" disabled={invalid} onClick={() => onApply(f)}>{t("apply")}</button>
			</PanelActions>
		</PopoverPanel>
	);
}

export type PlaceFilterInitial = { areaId: string | null; km: number; name: string; center: LatLng | null };
type Initial = PlaceFilterInitial;
export type PlaceFilter = { area: Area | null; center: LatLng; km: number; name: string };
type Filter = PlaceFilter;

// Shared with the housing/job boards.
export function LocationFilterPanel({ initial, onApply, onClose }: {
	initial: Initial | null;
	onApply: (f: Filter | null) => void;
	onClose: () => void;
}) {
	const t = useTranslations("market");
	const L = useLabels();
	const [area, setArea] = useState<Area | null>(null);
	const [center, setCenter] = useState<LatLng | null>(initial?.center ?? null);
	const [name, setName] = useState(initial?.name ?? "");
	const [km, setKm] = useState(initial?.km ?? 0);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Place[]>([]);
	const [error, setError] = useState("");

	useEffect(() => {
		if (initial?.areaId) fetchArea(initial.areaId).then(setArea).catch(() => {});
	}, [initial?.areaId]);

	useEffect(() => {
		const q = query.trim();
		if (q.length < 2) {
			setResults([]);
			return;
		}
		const ctrl = new AbortController();
		const timer = setTimeout(() => searchPlaces(q, ctrl.signal).then(setResults).catch(() => {}), 500);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	}, [query]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	// A picked place selects its town / arrondissement; "내 위치" keeps
	// the user's own point as the centre of the distance.
	const pick = async (p: LatLng, keepPoint = false) => {
		setError("");
		try {
			const a = await resolveArea(p);
			if (!a) {
				setError(t("noArea"));
				return;
			}
			setArea(a);
			setName(a.Name);
			setCenter(keepPoint ? p : areaCenter(a));
			if (keepPoint && km === 0) setKm(5);
		} catch (e) {
			setError(e instanceof Error ? e.message : t("checkError"));
		}
	};

	return (
		<PopoverPanel role="dialog" aria-label={t("placeFilter")}>
			<strong>{t("where")}</strong>
			<PlaceSearch>
				<input
					type="search"
					placeholder={t("placePlaceholder")}
					aria-label={t("placeLabel")}
					value={query}
					onChange={e => setQuery(e.target.value)}
				/>
				<GhostButton
					type="button"
					onClick={() => currentPosition().then(p => pick(p, true)).catch(e => setError(e.message))}
				>
					<LocateFixed size={16} /> {t("myPosition")}
				</GhostButton>
				{results.length > 0 && (
					<PlaceResults>
						{results.map(r => (
							<li key={`${r.Lat},${r.Lng}`}>
								<button type="button" onClick={() => {
									setQuery("");
									setResults([]);
									pick({ lat: r.Lat, lng: r.Lng });
								}}>
									<strong>{r.Label}</strong>
									<small>{r.Detail}</small>
								</button>
							</li>
						))}
					</PlaceResults>
				)}
			</PlaceSearch>
			<MapBox $h={220}>
				<PickerMap pin={null} area={area} radiusKm={km || undefined} onPick={p => pick(p)} />
			</MapBox>
			{name && <Muted>{name} · {L.distance(km)}</Muted>}
			<RadiusChips role="group" aria-label={t("distance")}>
				{SEARCH_DISTANCES.map(d => (
					<button key={d} type="button" aria-pressed={km === d} disabled={d === 0 && !area} onClick={() => setKm(d)}>
						{L.distance(d)}
					</button>
				))}
			</RadiusChips>
			{error && <Muted role="alert">{error}</Muted>}
			<PanelActions>
				<GhostButton type="button" onClick={() => onApply(null)}>{t("clearPlace")}</GhostButton>
				<button type="button" disabled={!center} onClick={() => center && onApply({ area, center, km, name })}>{t("apply")}</button>
			</PanelActions>
		</PopoverPanel>
	);
}
