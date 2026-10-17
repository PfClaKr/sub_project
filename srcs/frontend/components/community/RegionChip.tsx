'use client';

import { MapPin } from "lucide-react";
import { REGIONS } from "@/libs/constants";
import { useRegion } from "@/libs/region";
import { RegionSelect } from "@/styles/styledCommunity";

// RegionChip switches the region filter shared by the hub and boards.
export function RegionChip() {
	const { city, setCity } = useRegion();
	return (
		<RegionSelect>
			<MapPin size={16} aria-hidden />
			<span className="sr-only">지역</span>
			<select value={city} onChange={e => setCity(e.target.value)}>
				<option value="">전체 지역</option>
				{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
			</select>
		</RegionSelect>
	);
}
