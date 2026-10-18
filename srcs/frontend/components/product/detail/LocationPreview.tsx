'use client';

import { useEffect, useState } from "react";
import { Map as MapIcon, MapPin } from "lucide-react";
import { PreviewMap } from "@/components/map";
import { Description } from "@/styles/styledDetail";
import { LocationSummary, MapBox } from "@/styles/styledLocation";
import { fetchArea, type Area, type LatLng } from "@/libs/geo";
import { useLocale, useTranslations } from "next-intl";

// Exact locations show a pin; otherwise the town / arrondissement is
// outlined, as on leboncoin.
export function LocationPreview({ point, exact, areaId, areaName, label }: {
	point: LatLng;
	exact: boolean;
	areaId: string | null;
	areaName: string | null;
	label: string;
}) {
	const t = useTranslations("product");
	const [area, setArea] = useState<Area | null>(null);

	useEffect(() => {
		if (!exact && areaId) fetchArea(areaId).then(setArea).catch(() => {});
	}, [exact, areaId]);

	return (
		<Description aria-label={t("meetArea")}>
			<h2>{t("meetArea")}</h2>
			<MapBox $h={280}>
				<PreviewMap pin={exact ? point : null} area={area} />
			</MapBox>
			<LocationSummary>
				{exact ? <MapPin size={16} aria-hidden /> : <MapIcon size={16} aria-hidden />}
				<span>{exact ? label : t("around", { area: areaName ?? label })}</span>
			</LocationSummary>
		</Description>
	);
}
