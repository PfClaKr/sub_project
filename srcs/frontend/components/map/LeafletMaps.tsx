'use client';

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { Circle, GeoJSON, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import palette from "@/theme/colorPalette";
import { PARIS, type Area, type LatLng } from "@/libs/geo";

// A CSS pin (see .itnyang-pin in globalStyles) instead of Leaflet's
// default PNG marker, whose asset paths break under bundlers.
const pinIcon = L.divIcon({
	className: "itnyang-pin",
	html: "<span></span>",
	iconSize: [30, 40],
	iconAnchor: [15, 38],
});

// The area is drawn along its boundary, like leboncoin.
const areaStyle: L.PathOptions = {
	color: palette.primary,
	weight: 2.5,
	fillColor: palette.accent,
	fillOpacity: 0.2,
};

const radiusStyle: L.PathOptions = {
	color: palette.primary,
	weight: 1.5,
	dashArray: "6 6",
	fillOpacity: 0.04,
};

function Tiles() {
	return (
		<TileLayer
			attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
		/>
	);
}

function areaBounds(area: Area): L.LatLngBounds {
	return L.geoJSON(area.Geometry).getBounds();
}

// Fits the view to what matters: the radius, else the area, else the pin.
function Fit({ point, area, radiusKm, animate }: { point: LatLng | null; area: Area | null; radiusKm?: number; animate: boolean }) {
	const map = useMap();
	const areaId = area?.AreaId;
	useEffect(() => {
		const opts = animate ? { duration: 0.6 } : undefined;
		const center = point ?? (area ? { lat: area.CenterLat, lng: area.CenterLng } : null);
		if (radiusKm && center) {
			const b = L.latLng(center.lat, center.lng).toBounds(radiusKm * 2000 * 1.1);
			animate ? map.flyToBounds(b, opts) : map.fitBounds(b);
		} else if (area && !point) {
			animate ? map.flyToBounds(areaBounds(area), { ...opts, padding: [16, 16] }) : map.fitBounds(areaBounds(area), { padding: [16, 16] });
		} else if (point) {
			animate ? map.flyTo([point.lat, point.lng], 16, opts) : map.setView([point.lat, point.lng], 16);
		}
	}, [point?.lat, point?.lng, areaId, radiusKm]); // eslint-disable-line react-hooks/exhaustive-deps
	return null;
}

function ClickToPlace({ onPick }: { onPick: (p: LatLng) => void }) {
	useMapEvents({ click: e => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
	return null;
}

// Interactive map used by the sell form and the search filter.
// pin: exact point (draggable). area: boundary drawn. radiusKm: dashed
// circle around the pin or the area centre.
export function PickerMap({ pin, area, radiusKm, onPick }: {
	pin: LatLng | null;
	area: Area | null;
	radiusKm?: number;
	onPick: (p: LatLng) => void;
}) {
	const start = pin ?? (area ? { lat: area.CenterLat, lng: area.CenterLng } : PARIS);
	const center = pin ?? (area ? { lat: area.CenterLat, lng: area.CenterLng } : null);
	return (
		<MapContainer center={[start.lat, start.lng]} zoom={pin || area ? 13 : 12} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
			<Tiles />
			<ClickToPlace onPick={onPick} />
			<Fit point={pin} area={area} radiusKm={radiusKm} animate />
			{area && <GeoJSON key={area.AreaId} data={area.Geometry} style={areaStyle} interactive={false} />}
			{radiusKm && center ? <Circle center={[center.lat, center.lng]} radius={radiusKm * 1000} pathOptions={radiusStyle} interactive={false} /> : null}
			{pin && (
				<Marker
					position={[pin.lat, pin.lng]}
					icon={pinIcon}
					draggable
					eventHandlers={{
						dragend: e => {
							const ll = (e.target as L.Marker).getLatLng();
							onPick({ lat: ll.lat, lng: ll.lng });
						},
					}}
				/>
			)}
		</MapContainer>
	);
}

// Read-only map for the product page: a pin for an exact location,
// otherwise only the town / arrondissement outline.
export function PreviewMap({ pin, area }: { pin: LatLng | null; area: Area | null }) {
	const start = pin ?? (area ? { lat: area.CenterLat, lng: area.CenterLng } : PARIS);
	return (
		<MapContainer center={[start.lat, start.lng]} zoom={pin ? 15 : 13} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
			<Tiles />
			<Fit point={pin} area={pin ? null : area} animate={false} />
			{area && !pin && <GeoJSON key={area.AreaId} data={area.Geometry} style={areaStyle} interactive={false} />}
			{pin && <Marker position={[pin.lat, pin.lng]} icon={pinIcon} />}
		</MapContainer>
	);
}
