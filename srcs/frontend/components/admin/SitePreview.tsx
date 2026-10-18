'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Eye, Mail, Monitor, RefreshCw, Smartphone, Tablet, X } from "lucide-react";
import { API_URL } from "@/libs/config";
import { libText } from "@/libs/libText";
import { PREVIEW_COOKIE, type SiteSettings } from "@/libs/site";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";
import { colors, cssVar, type ColorToken } from "@/theme/colorPalette";
import { endPreview } from "@/components/PreviewBar";
import { ErrorText, GhostButton, Muted } from "@/styles/styledUi";
import { PreviewBox } from "@/styles/styledSiteEditor";

// Unsaved changes: settings replacing the saved ones, and/or text
// overrides per language ("" = back to the built-in text).
export type Draft = { Settings?: SiteSettings; Texts?: Partial<Record<Locale, Record<string, string>>> };

const DEVICES = {
	desktop: { width: 1280, height: 860, icon: Monitor },
	tablet: { width: 820, height: 1100, icon: Tablet },
	phone: { width: 390, height: 800, icon: Smartphone },
} as const;
type Device = keyof typeof DEVICES;

export const PREVIEW_PAGES = {
	"/": "home", "/search": "search", "/community": "community", "/housing": "housing",
	"/jobs": "jobs", "/safety": "safety", "/notifications": "notifications", "/myaccount": "myaccount",
} as const;
export type PreviewPage = keyof typeof PREVIEW_PAGES;

// pageForKey guesses where a text shows (the first part of its key), for
// the texts tab's "show in preview".
export function pageForKey(key: string): PreviewPage | null {
	const top = key.split(".")[0];
	const map: Record<string, PreviewPage> = {
		home: "/", community: "/community", listing: "/housing", safety: "/safety", market: "/search",
		product: "/search", gallery: "/search", notifications: "/notifications", account: "/myaccount", profile: "/myaccount",
	};
	return map[top] ?? null;
}

// What needs a reload of the frame: colours are applied live.
const reloadKey = (locale: string, draft: Draft) =>
	locale + JSON.stringify({ ...draft, Settings: draft.Settings && { ...draft.Settings, Theme: undefined } });

// SitePreview shows the real site with the admin's unsaved changes. The
// draft is stored per admin (apiserver PUT /admin/site/preview) and a
// cookie makes this browser's pages render it (libs/site.server.ts), so
// visitors never see it. Closing the preview drops both.
export function SitePreview({ draft, locale, onLocale, page, onPage, onClose }: {
	draft: Draft;
	locale: Locale;
	onLocale?: (l: Locale) => void; // absent: the language is fixed (texts tab)
	page: PreviewPage;
	onPage: (p: PreviewPage) => void;
	onClose: () => void;
}) {
	const t = useTranslations("admin.site.preview");
	const frame = useRef<HTMLIFrameElement | null>(null);
	const stage = useRef<HTMLDivElement | null>(null);
	const shown = useRef<string | null>(null);
	const scrollBack = useRef<number | null>(null);
	// Only rendered after the admin opens it, so window is there.
	const [device, setDevice] = useState<Device>(() => (window.innerWidth < 900 ? "phone" : "desktop"));
	const [width, setWidth] = useState(0);
	const [ready, setReady] = useState(false);
	const [error, setError] = useState("");
	const draftJson = JSON.stringify(draft);
	const themeJson = JSON.stringify(draft.Settings?.Theme ?? null);

	useEffect(() => {
		document.cookie = `${PREVIEW_COOKIE}=${locale}; path=/; max-age=3600; samesite=lax`;
	}, [locale]);
	useEffect(() => () => void endPreview(), []);

	// Store the draft (debounced), then reload the frame unless only the
	// colours changed.
	useEffect(() => {
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`${API_URL}/admin/site/preview`, {
					method: "PUT",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: draftJson,
				});
				if (!res.ok) {
					setError((await res.json().catch(() => null))?.error ?? libText("server"));
					return;
				}
				setError("");
				const key = reloadKey(locale, JSON.parse(draftJson));
				if (shown.current === null) setReady(true);
				else if (shown.current !== key) reload();
				shown.current = key;
			} catch {
				setError(libText("server"));
			}
		}, 400);
		return () => clearTimeout(timer);
	}, [draftJson, locale]);

	// Reload in place. The browser's own scroll restoration would shift
	// the page by whatever the draft added above (a notice), so keep the
	// position by hand.
	const reload = () => {
		const win = frame.current?.contentWindow;
		if (!win) return;
		scrollBack.current = win.scrollY;
		win.history.scrollRestoration = "manual";
		win.location.reload();
	};
	const onLoad = () => {
		if (scrollBack.current !== null) frame.current?.contentWindow?.scrollTo(0, scrollBack.current);
		scrollBack.current = null;
		applyTheme();
	};

	const applyTheme = useCallback(() => {
		const theme = JSON.parse(themeJson) as SiteSettings["Theme"] | null;
		const root = frame.current?.contentDocument?.documentElement;
		if (!theme || !root) return;
		for (const token of Object.keys(colors) as ColorToken[]) root.style.setProperty(cssVar(token), theme[token] ?? colors[token]);
	}, [themeJson]);
	useEffect(applyTheme, [applyTheme]);

	useEffect(() => {
		const el = stage.current;
		if (!el) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const size = DEVICES[device];
	const scale = width ? Math.min(1, width / size.width) : 1;

	return (
		<PreviewBox aria-label={t("title")}>
			<div className="toolbar">
				<h3><Eye size={16} aria-hidden /> {t("title")}</h3>
				<GhostButton type="button" onClick={onClose} aria-label={t("close")}><X size={14} aria-hidden /></GhostButton>
			</div>
			<div className="toolbar">
				<select value={page} onChange={e => onPage(e.target.value as PreviewPage)} aria-label={t("page")}>
					{(Object.keys(PREVIEW_PAGES) as PreviewPage[]).map(p => <option key={p} value={p}>{t(`pages.${PREVIEW_PAGES[p]}`)}</option>)}
				</select>
				{onLocale ? (
					<select value={locale} onChange={e => onLocale(e.target.value as Locale)} aria-label={t("language")}>
						{LOCALES.map(l => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
					</select>
				) : (
					<Muted>{LOCALE_LABELS[locale]}</Muted>
				)}
				<div className="devices" role="group" aria-label={t("device")}>
					{(Object.keys(DEVICES) as Device[]).map(d => {
						const Icon = DEVICES[d].icon;
						return (
							<button key={d} type="button" aria-pressed={device === d} aria-label={t(d)} title={t(d)} onClick={() => setDevice(d)}>
								<Icon size={16} aria-hidden />
							</button>
						);
					})}
				</div>
				<GhostButton type="button" onClick={reload} aria-label={t("reload")} title={t("reload")}>
					<RefreshCw size={14} aria-hidden />
				</GhostButton>
				<GhostButton as="a" href={page} target="_blank" rel="noopener">
					<ExternalLink size={14} aria-hidden /> {t("newWindow")}
				</GhostButton>
			</div>
			<Muted as="p" className="lead">{t("lead")}</Muted>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<div className="stage" ref={stage}>
				<div style={{ width: size.width * scale, height: size.height * scale }}>
					{ready && (
						<iframe
							key={page}
							ref={frame}
							src={page}
							title={t("frameTitle")}
							onLoad={onLoad}
							style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
						/>
					)}
				</div>
			</div>
		</PreviewBox>
	);
}

type MailSample = { Subject: string; From: string; HTML: string };

// MailPreview renders the members' mails (sample content) in the theme
// being edited (apiserver POST /admin/site/preview/mail).
export function MailPreview({ theme, types }: { theme: SiteSettings["Theme"]; types: string[] }) {
	const t = useTranslations("admin.site.mail");
	const tp = useTranslations("admin.site.preview");
	const [type, setType] = useState(types[0] ?? "verify");
	const [locale, setLocale] = useState<Locale>(useLocale() as Locale);
	const [phone, setPhone] = useState(false);
	const [mail, setMail] = useState<MailSample | null>(null);
	const [height, setHeight] = useState(640);
	const [error, setError] = useState("");
	const themeJson = JSON.stringify(theme);

	useEffect(() => {
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`${API_URL}/admin/site/preview/mail`, {
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ Type: type, Locale: locale, Theme: JSON.parse(themeJson) }),
				});
				if (!res.ok) throw new Error();
				setMail(await res.json());
				setError("");
			} catch {
				setError(libText("server"));
			}
		}, 250);
		return () => clearTimeout(timer);
	}, [type, locale, themeJson]);

	return (
		<PreviewBox aria-label={t("title")} style={{ position: "static" }}>
			<div className="toolbar">
				<h3><Mail size={16} aria-hidden /> {t("title")}</h3>
			</div>
			<div className="toolbar">
				<select value={type} onChange={e => setType(e.target.value)} aria-label={t("type")}>
					{types.map(k => <option key={k} value={k}>{t(`types.${k}`)}</option>)}
				</select>
				<select value={locale} onChange={e => setLocale(e.target.value as Locale)} aria-label={tp("language")}>
					{LOCALES.map(l => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
				</select>
				<div className="devices" role="group" aria-label={tp("device")}>
					<button type="button" aria-pressed={!phone} aria-label={tp("desktop")} title={tp("desktop")} onClick={() => setPhone(false)}><Monitor size={16} aria-hidden /></button>
					<button type="button" aria-pressed={phone} aria-label={tp("phone")} title={tp("phone")} onClick={() => setPhone(true)}><Smartphone size={16} aria-hidden /></button>
				</div>
			</div>
			<Muted as="p" className="lead">{t("lead")}</Muted>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			{mail && (
				<div className="inbox">
					<strong>{mail.From}</strong>
					<span>{mail.Subject}</span>
				</div>
			)}
			<div className="stage">
				{mail && (
					// No scripts run in the frame; same-origin only so the
					// height can be read.
					<iframe
						key={phone ? "phone" : "desktop"}
						srcDoc={mail.HTML}
						sandbox="allow-same-origin"
						title={t("title")}
						onLoad={e => setHeight(e.currentTarget.contentDocument?.documentElement.scrollHeight ?? 640)}
						style={{ width: phone ? 375 : "100%", height }}
					/>
				)}
			</div>
		</PreviewBox>
	);
}
