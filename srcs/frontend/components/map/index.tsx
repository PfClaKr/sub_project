'use client';

import dynamic from "next/dynamic";
import { Skeleton } from "@/styles/styledUi";

// Leaflet touches `window` at import time, so the maps only load in the
// browser.
const loading = () => <Skeleton $h="100%" />;

export const PickerMap = dynamic(() => import("./LeafletMaps").then(m => m.PickerMap), { ssr: false, loading });
export const PreviewMap = dynamic(() => import("./LeafletMaps").then(m => m.PreviewMap), { ssr: false, loading });
