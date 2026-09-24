'use client';

import { useEffect, useRef, useState } from "react";
import { LocateFixed, Map as MapIcon, MapPin } from "lucide-react";
import { PickerMap } from "@/components/map";
import { FieldLabel, Hint } from "@/styles/styledForm";
import { ErrorText, GhostButton, Muted } from "@/styles/styledUi";
import { MapBox, PlaceResults, PlaceSearch, Segmented } from "@/styles/styledLocation";
import {
	areaLabel, currentPosition, fetchArea, resolveArea, searchPlaces, streetLabel,
	type Area, type LatLng, type Place,
} from "@/libs/geo";

export type LocationState = {
	point: LatLng | null;
	exact: boolean;
	area: Area | null;
	areaId?: string; // from a saved product, until the area is fetched
	label: string;
};

// LocationField works like leboncoin: by default only the town (or the
// Paris arrondissement) is shown, outlined on the map; the seller may
// choose to show the exact spot instead. In area mode the server stores
// the area centre, never the picked point.
export function LocationField({ value, onChange }: {
	value: LocationState;
	onChange: (next: LocationState) => void;
}) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Place[]>([]);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	const labelEdited = useRef(!!value.label);
	const latest = useRef(value);
	latest.current = value;

	const emit = (patch: Partial<LocationState>) => {
		latest.current = { ...latest.current, ...patch };
		onChange(latest.current);
	};

	// A saved product only carries its AreaId; load the outline once.
	useEffect(() => {
		if (value.areaId && !value.area) {
			fetchArea(value.areaId).then(area => area && emit({ area })).catch(() => {});
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Debounced place search.
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

	const autoLabel = async (point: LatLng, area: Area | null, exact: boolean) => {
		if (labelEdited.current && latest.current.label) return;
		const street = exact ? await streetLabel(point) : "";
		// Drop answers for a point or mode that has changed since.
		const now = latest.current;
		if (now.point?.lat !== point.lat || now.point?.lng !== point.lng || now.exact !== exact) return;
		const parts = [street, area?.Name].filter(Boolean);
		if (parts.length) emit({ label: parts.join(", ") });
	};

	const place = async (point: LatLng) => {
		setError("");
		setBusy(true);
		emit({ point, areaId: undefined });
		try {
			const area = await resolveArea(point);
			if (latest.current.point !== point) return;
			emit({ area });
			if (!area && !latest.current.exact) {
				setError("이 위치의 동네를 찾지 못했어요. 다른 곳을 고르거나 정확한 위치로 표시해주세요.");
			}
			await autoLabel(point, area, latest.current.exact);
		} catch (e) {
			setError(e instanceof Error ? e.message : "위치를 확인하지 못했어요.");
		} finally {
			setBusy(false);
		}
	};

	const setExact = (exact: boolean) => {
		emit({ exact });
		// Switching to the area must not keep the street in the label.
		labelEdited.current = false;
		if (value.point) autoLabel(value.point, value.area, exact);
	};

	const useMyPosition = async () => {
		try {
			await place(await currentPosition());
		} catch (e) {
			setError(e instanceof Error ? e.message : "현재 위치를 가져오지 못했어요.");
		}
	};

	return (
		<FieldLabel as="div">
			<Segmented role="group" aria-label="위치 표시 방식">
				<button type="button" aria-pressed={!value.exact} onClick={() => setExact(false)}><MapIcon size={16} /> 동네만 표시</button>
				<button type="button" aria-pressed={value.exact} onClick={() => setExact(true)}><MapPin size={16} /> 정확한 위치</button>
			</Segmented>
			<Hint>
				{value.exact
					? "지도에 핀이 그대로 표시돼요. 역이나 공공장소를 추천해요."
					: "구매자에게는 동네(파리는 구) 경계만 보여요. 정확한 주소는 공개되지 않아요."}
			</Hint>

			<PlaceSearch>
				<input
					type="search"
					placeholder="주소, 역, 동네 검색 (예: Porte de Versailles)"
					aria-label="장소 검색"
					value={query}
					onChange={e => setQuery(e.target.value)}
					onBlur={() => setTimeout(() => setResults([]), 150)}
				/>
				<GhostButton type="button" onClick={useMyPosition} disabled={busy}>
					<LocateFixed size={16} /> 현재 위치
				</GhostButton>
				{results.length > 0 && (
					<PlaceResults role="listbox" aria-label="검색된 장소">
						{results.map(r => (
							<li key={`${r.Lat},${r.Lng}`}>
								<button
									type="button"
									onMouseDown={e => e.preventDefault()}
									onClick={() => {
										setQuery("");
										setResults([]);
										place({ lat: r.Lat, lng: r.Lng });
									}}
								>
									<strong>{r.Label}</strong>
									<small>{r.Detail}</small>
								</button>
							</li>
						))}
					</PlaceResults>
				)}
			</PlaceSearch>

			<MapBox>
				<PickerMap
					pin={value.exact ? value.point : null}
					area={value.exact ? null : value.area}
					onPick={p => place(p)}
				/>
			</MapBox>
			<Muted>
				{busy
					? "위치를 확인하는 중..."
					: value.area
						? `${areaLabel(value.area)} · ${value.exact ? "핀 위치가 그대로 보여요" : "이 지역이 표시돼요"}`
						: "지도를 누르거나 장소를 검색해서 위치를 골라주세요."}
			</Muted>

			<FieldLabel>
				표시될 위치 이름 <Hint>목록과 상세 페이지에 보여요</Hint>
				<input
					type="text"
					required
					maxLength={100}
					placeholder="예: Paris 15e · 보지라르역"
					value={value.label}
					onChange={e => {
						labelEdited.current = true;
						emit({ label: e.target.value });
					}}
				/>
			</FieldLabel>
			{error && <ErrorText role="alert">{error}</ErrorText>}
		</FieldLabel>
	);
}
