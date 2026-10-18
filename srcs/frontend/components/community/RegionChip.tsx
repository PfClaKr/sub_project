'use client';

import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
import { REGIONS } from "@/libs/constants";
import { useRegion } from "@/libs/region";
import { RegionSelect } from "@/styles/styledCommunity";

// RegionChip switches the region filter shared by the hub and boards.
export function RegionChip() {
	const t = useTranslations("common");
	const L = useLabels();
	const { city, setCity } = useRegion();
	return (
		<RegionSelect>
			<MapPin size={16} aria-hidden />
			<span className="sr-only">{t("region")}</span>
			<select value={city} onChange={e => setCity(e.target.value)}>
				<option value="">{t("allRegions")}</option>
				{REGIONS.map(r => <option key={r} value={r}>{L.enum("region", r)}</option>)}
			</select>
		</RegionSelect>
	);
}
