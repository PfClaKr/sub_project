'use client';

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LocateFixed, MapPin, SlidersHorizontal } from "lucide-react";
import { REGIONS } from "@/libs/constants";
import { Adorned, FieldLabel, TwoColumns } from "@/styles/styledForm";
import { PickerMap } from "@/components/map";
import { GhostButton, Muted } from "@/styles/styledUi";
import { FilterButton, PanelActions, Popover, PopoverPanel, Toolbar } from "@/styles/styledSearch";
import { MapBox, PlaceResults, PlaceSearch, RadiusChips } from "@/styles/styledLocation";
import {
	areaCenter, currentPosition, distanceLabel, fetchArea, resolveArea, searchPlaces, SEARCH_DISTANCES,
	type Area, type LatLng, type Place,
} from "@/libs/geo";

const SORTS = [
	{ value: "", label: "관련순" },
	{ value: "newest", label: "최신순" },
	{ value: "price_asc", label: "낮은 가격순" },
	{ value: "price_desc", label: "높은 가격순" },
	{ value: "distance", label: "가까운순", needsPlace: true },
];

// SearchControls edits the sort and the place filter through the URL
// (area, place, lat, lng, km), so results stay shareable and the server
// page runs the query. Like leboncoin's "Localisation" + "Rayon".
export function SearchControls({ total }: { total: number }) {
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
		const q = next.toString();
		router.push(q ? `${pathname}?${q}` : pathname, { scroll: false });
	};

	return (
		<Toolbar>
			<Muted>{total}개의 상품</Muted>
			<span style={{ flex: 1 }} />
			<Popover>
				<FilterButton $on={filterCount > 0} onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}>
					<SlidersHorizontal size={16} /> 필터{filterCount > 0 ? ` ${filterCount}` : ""}
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
					<MapPin size={16} /> {hasPlace ? `${placeName ?? "선택한 위치"} · ${distanceLabel(km)}` : "위치 설정"}
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
			<select aria-label="정렬" value={sort} onChange={e => update({ sort: e.target.value || null })}>
				{SORTS.filter(s => !s.needsPlace || hasPlace).map(s => (
					<option key={s.value} value={s.value}>{s.label}</option>
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
	const [f, setF] = useState(initial);
	const invalid = !!f.min && !!f.max && Number(f.min) > Number(f.max);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<PopoverPanel role="dialog" aria-label="필터">
			<strong>필터</strong>
			<FieldLabel>지역
				<select value={f.region} onChange={e => setF({ ...f, region: e.target.value })}>
					<option value="">전체</option>
					{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
				</select>
			</FieldLabel>
			<TwoColumns>
				<FieldLabel>최소 가격
					<Adorned><span aria-hidden>€</span>
						<input type="number" min={0} inputMode="decimal" placeholder="0" value={f.min} onChange={e => setF({ ...f, min: e.target.value })} />
					</Adorned>
				</FieldLabel>
				<FieldLabel>최대 가격
					<Adorned><span aria-hidden>€</span>
						<input type="number" min={0} inputMode="decimal" placeholder="제한 없음" value={f.max} onChange={e => setF({ ...f, max: e.target.value })} />
					</Adorned>
				</FieldLabel>
			</TwoColumns>
			{invalid && <Muted role="alert">최소 가격이 최대 가격보다 커요.</Muted>}
			<PanelActions>
				<GhostButton type="button" onClick={() => onApply({ region: "", min: "", max: "" })}>초기화</GhostButton>
				<button type="button" disabled={invalid} onClick={() => onApply(f)}>적용</button>
			</PanelActions>
		</PopoverPanel>
	);
}

type Initial = { areaId: string | null; km: number; name: string; center: LatLng | null };
type Filter = { area: Area | null; center: LatLng; km: number; name: string };

function LocationFilterPanel({ initial, onApply, onClose }: {
	initial: Initial | null;
	onApply: (f: Filter | null) => void;
	onClose: () => void;
}) {
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
		const t = setTimeout(() => searchPlaces(q, ctrl.signal).then(setResults).catch(() => {}), 500);
		return () => {
			clearTimeout(t);
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
				setError("이 위치의 동네를 찾지 못했어요.");
				return;
			}
			setArea(a);
			setName(a.Name);
			setCenter(keepPoint ? p : areaCenter(a));
			if (keepPoint && km === 0) setKm(5);
		} catch (e) {
			setError(e instanceof Error ? e.message : "위치를 확인하지 못했어요.");
		}
	};

	return (
		<PopoverPanel role="dialog" aria-label="위치 필터">
			<strong>어디에서 찾을까요?</strong>
			<PlaceSearch>
				<input
					type="search"
					placeholder="동네, 구, 역 (예: Paris 15, Boulogne)"
					aria-label="장소 검색"
					value={query}
					onChange={e => setQuery(e.target.value)}
				/>
				<GhostButton
					type="button"
					onClick={() => currentPosition().then(p => pick(p, true)).catch(e => setError(e.message))}
				>
					<LocateFixed size={16} /> 내 위치
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
			{name && <Muted>{name} · {distanceLabel(km)}</Muted>}
			<RadiusChips role="group" aria-label="거리">
				{SEARCH_DISTANCES.map(d => (
					<button key={d} type="button" aria-pressed={km === d} disabled={d === 0 && !area} onClick={() => setKm(d)}>
						{distanceLabel(d)}
					</button>
				))}
			</RadiusChips>
			{error && <Muted role="alert">{error}</Muted>}
			<PanelActions>
				<GhostButton type="button" onClick={() => onApply(null)}>위치 해제</GhostButton>
				<button type="button" disabled={!center} onClick={() => center && onApply({ area, center, km, name })}>적용</button>
			</PanelActions>
		</PopoverPanel>
	);
}
