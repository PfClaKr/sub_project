import type { Geometry } from "geojson";
import { API_URL } from "@/libs/config";

// Places and areas come from the apiserver's /geo proxy, which throttles
// and caches OpenStreetMap Nominatim (see apiserver/geohandler).

export type LatLng = { lat: number; lng: number };

// A town, or an arrondissement inside Paris, with its boundary: what
// leboncoin shows instead of an address.
export type Area = {
	AreaId: string;
	Name: string;
	Postcode: string;
	CenterLat: number;
	CenterLng: number;
	Geometry: Geometry;
};

export type Place = { Label: string; Detail: string; Lat: number; Lng: number };

export const PARIS: LatLng = { lat: 48.8566, lng: 2.3522 };

// Search distances (km); 0 means "inside the chosen area only".
export const SEARCH_DISTANCES = [0, 5, 10, 20, 50];

// Shared by the (server) search page and the (client) filter.
export function distanceLabel(km: number): string {
	return km === 0 ? "이 지역만" : `+${km}km`;
}

export function areaLabel(a: Pick<Area, "Name" | "Postcode">): string {
	return a.Postcode ? `${a.Name} (${a.Postcode})` : a.Name;
}

export function areaCenter(a: Area): LatLng {
	return { lat: a.CenterLat, lng: a.CenterLng };
}

async function geo<T>(path: string, signal?: AbortSignal): Promise<T | null> {
	const res = await fetch(`${API_URL}/geo${path}`, { signal });
	if (res.status === 404) return null;
	if (!res.ok) throw new Error("지도 서비스에 연결하지 못했어요.");
	return res.json();
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
	return (await geo<Place[]>(`/search?q=${encodeURIComponent(query)}`, signal)) ?? [];
}

// The area containing a point, or null outside any town (e.g. at sea).
export function resolveArea(p: LatLng): Promise<Area | null> {
	return geo<Area>(`/resolve?lat=${p.lat.toFixed(6)}&lng=${p.lng.toFixed(6)}`);
}

export function fetchArea(id: string): Promise<Area | null> {
	return geo<Area>(`/areas/${encodeURIComponent(id)}`);
}

// "12 Rue X" for an exact pin; "" when unknown.
export async function streetLabel(p: LatLng): Promise<string> {
	try {
		return (await geo<{ Street: string }>(`/address?lat=${p.lat.toFixed(6)}&lng=${p.lng.toFixed(6)}`))?.Street ?? "";
	} catch {
		return "";
	}
}

export function currentPosition(): Promise<LatLng> {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error("이 브라우저는 위치 확인을 지원하지 않아요."));
			return;
		}
		navigator.geolocation.getCurrentPosition(
			pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
			() => reject(new Error("현재 위치를 가져오지 못했어요. 위치 권한을 확인해주세요.")),
			{ enableHighAccuracy: true, timeout: 10000 },
		);
	});
}
