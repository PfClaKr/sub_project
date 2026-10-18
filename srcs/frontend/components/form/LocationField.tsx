'use client';

import { useEffect, useRef, useState } from "react";
import { LocateFixed, Map as MapIcon, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
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
// areaOnly hides the "exact location" choice (housing never shows an
// address); exactHint replaces the hint shown for an exact pin.
export function LocationField({ value, onChange, areaOnly, exactHint }: {
	value: LocationState;
	onChange: (next: LocationState) => void;
	areaOnly?: boolean;
	exactHint?: string;
}) {
	const t = useTranslations("location");
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
				setError(t("noArea"));
			}
			await autoLabel(point, area, latest.current.exact);
		} catch (e) {
			setError(e instanceof Error ? e.message : t("checkError"));
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
			setError(e instanceof Error ? e.message : t("gpsError"));
		}
	};

	return (
		<FieldLabel as="div">
			{!areaOnly && (
				<Segmented role="group" aria-label={t("modeLabel")}>
					<button type="button" aria-pressed={!value.exact} onClick={() => setExact(false)}><MapIcon size={16} /> {t("areaOnly")}</button>
					<button type="button" aria-pressed={value.exact} onClick={() => setExact(true)}><MapPin size={16} /> {t("exact")}</button>
				</Segmented>
			)}
			<Hint>
				{value.exact
					? exactHint ?? t("exactHint")
					: t(areaOnly ? "areaHintChat" : "areaHintBuyer")}
			</Hint>

			<PlaceSearch>
				<input
					type="search"
					placeholder={t("searchPlaceholder")}
					aria-label={t("searchLabel")}
					value={query}
					onChange={e => setQuery(e.target.value)}
					onBlur={() => setTimeout(() => setResults([]), 150)}
				/>
				<GhostButton type="button" onClick={useMyPosition} disabled={busy}>
					<LocateFixed size={16} /> {t("myPosition")}
				</GhostButton>
				{results.length > 0 && (
					<PlaceResults role="listbox" aria-label={t("results")}>
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
					? t("checking")
					: value.area
						? t(value.exact ? "pinShown" : "areaShown", { area: areaLabel(value.area) })
						: t("pickHint")}
			</Muted>

			<FieldLabel>
				{t("label")} <Hint>{t("labelHint")}</Hint>
				<input
					type="text"
					required
					maxLength={100}
					placeholder={t("labelPlaceholder")}
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
