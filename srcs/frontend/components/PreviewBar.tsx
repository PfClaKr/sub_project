'use client';

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { API_URL } from "@/libs/config";
import { PREVIEW_COOKIE } from "@/libs/site";
import { PreviewRibbon } from "@/styles/styledLayout";

// endPreview drops the preview cookie and the admin's draft.
export function endPreview() {
	document.cookie = `${PREVIEW_COOKIE}=; path=/; max-age=0; samesite=lax`;
	return fetch(`${API_URL}/admin/site/preview`, { method: "DELETE", credentials: "include", keepalive: true }).catch(() => null);
}

// PreviewBar tells an admin that the page shows unsaved changes from the
// site editor (a tab left open, or "open in a new window"), with a way
// out. Inside the editor's own preview frame it stays hidden.
export function PreviewBar() {
	const t = useTranslations("preview");
	const [show, setShow] = useState(false);
	useEffect(() => setShow(window.self === window.top), []);
	if (!show) return null;
	return (
		<PreviewRibbon role="status">
			<Eye size={16} aria-hidden />
			<span>{t("bar")}</span>
			<button type="button" onClick={async () => { await endPreview(); window.location.reload(); }}>{t("end")}</button>
		</PreviewRibbon>
	);
}
