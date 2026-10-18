'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import ko from "@/messages/ko.json";
import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import { API_URL } from "@/libs/config";
import { formatDateTime } from "@/libs/format";
import { uploadImages } from "@/libs/upload";
import { libText } from "@/libs/libText";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/config";
import type { HomeSectionId, SiteSettings } from "@/libs/site";
import { colors, type ColorToken } from "@/theme/colorPalette";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Chip, ChipRow, ErrorText, GhostButton, Muted } from "@/styles/styledUi";
import { Table, TableWrap } from "@/styles/styledAdmin";
import { EditorGrid, KeyCell, SectionRow, Swatch, TextRow } from "@/styles/styledSiteEditor";

type LogEntry = { At: number; Target: string; Old: string; New: string; Admin: string };
export type AdminSite = {
	Texts: Record<Locale, Record<string, string>>;
	Settings: SiteSettings;
	Log: LogEntry[];
	ThemeTokens: ColorToken[];
};

const CATALOGS: Record<Locale, Tree> = { ko, fr, en };
const TABS = ["texts", "notice", "home", "theme", "log"] as const;
type Tab = (typeof TABS)[number];
type Tree = { [key: string]: string | Tree };

// flatten turns a messages tree into "a.b.c" → text.
function flatten(tree: Tree, prefix = "", out: Record<string, string> = {}): Record<string, string> {
	for (const key of Object.keys(tree)) {
		const value = tree[key];
		const path = prefix ? `${prefix}.${key}` : key;
		if (typeof value === "string") out[path] = value;
		else flatten(value, path, out);
	}
	return out;
}

// tokens lists the placeholders and tags an override must keep, as in
// i18n/messages.test.ts.
function tokens(text: string): string {
	return Array.from(new Set((text.match(/\{\w+|<\w+>/g) ?? []).map(t => t.replace("{", "")))).sort().join(" ");
}

async function send(method: "PUT" | "POST", path: string, body: unknown): Promise<string> {
	try {
		const res = await fetch(`${API_URL}/admin/site${path}`, {
			method,
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!res.ok) return (await res.json().catch(() => null))?.error ?? libText("server");
		// The site caches its content for 30 s; drop it now.
		await fetch("/api/site/revalidate", { method: "POST" }).catch(() => null);
		return "";
	} catch {
		return libText("server");
	}
}

// SiteEditor is /admin/site: texts per language, the notice banner, the
// home sections and hero image, theme colours and the change log.
export function SiteEditor({ initial, tab: initialTab }: { initial: AdminSite; tab?: string }) {
	const t = useTranslations("admin.site");
	const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "texts");
	return (
		<div>
			<ChipRow aria-label={t("tabs")} style={{ margin: "16px 0" }}>
				{TABS.map(k => (
					<Chip key={k} href={`?tab=${k}`} $active={tab === k} onClick={e => { e.preventDefault(); setTab(k); window.history.replaceState(null, "", `?tab=${k}`); }}>
						{t(`tab.${k}`)}
					</Chip>
				))}
			</ChipRow>
			{tab === "texts" && <TextsTab overrides={initial.Texts} />}
			{tab === "notice" && <NoticeTab settings={initial.Settings} />}
			{tab === "home" && <HomeTab settings={initial.Settings} />}
			{tab === "theme" && <ThemeTab settings={initial.Settings} tokens={initial.ThemeTokens} />}
			{tab === "log" && <LogTab log={initial.Log} />}
		</div>
	);
}

function TextsTab({ overrides }: { overrides: AdminSite["Texts"] }) {
	const t = useTranslations("admin.site");
	const router = useRouter();
	const pageLocale = useLocale() as Locale;
	const [locale, setLocale] = useState<Locale>(pageLocale);
	const [query, setQuery] = useState("");
	const [onlyChanged, setOnlyChanged] = useState(false);
	const defaults = useMemo(() => flatten(CATALOGS[locale]), [locale]);
	const korean = useMemo(() => flatten(CATALOGS.ko), []);
	const current = overrides[locale] ?? {};

	const q = query.trim().toLowerCase();
	const rows = Object.keys(defaults).filter(key => {
		if (onlyChanged && !(key in current)) return false;
		if (!q) return true;
		return key.toLowerCase().includes(q) || defaults[key].toLowerCase().includes(q) || korean[key].toLowerCase().includes(q) || (current[key] ?? "").toLowerCase().includes(q);
	});
	const shown = rows.slice(0, 60);

	return (
		<div>
			<EditorGrid>
				<label>
					{t("language")}
					<select value={locale} onChange={e => setLocale(e.target.value as Locale)}>
						{LOCALES.map(l => <option key={l} value={l}>{LOCALE_LABELS[l]}</option>)}
					</select>
				</label>
				<label style={{ flex: 1 }}>
					{t("search")}
					<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} />
				</label>
				<label className="check">
					<input type="checkbox" checked={onlyChanged} onChange={e => setOnlyChanged(e.target.checked)} /> {t("onlyChanged")}
				</label>
			</EditorGrid>
			<Muted as="p">{t("count", { shown: shown.length, total: rows.length })}</Muted>
			{shown.map(key => (
				<TextEditor
					key={`${locale}:${key}`}
					locale={locale}
					textKey={key}
					builtIn={defaults[key]}
					korean={locale === "ko" ? "" : korean[key]}
					override={current[key]}
					onSaved={() => router.refresh()}
				/>
			))}
		</div>
	);
}

function TextEditor({ locale, textKey, builtIn, korean, override, onSaved }: {
	locale: Locale; textKey: string; builtIn: string; korean: string; override?: string; onSaved: () => void;
}) {
	const t = useTranslations("admin.site");
	const [value, setValue] = useState(override ?? builtIn);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);
	const dirty = value !== (override ?? builtIn);

	const save = async (text: string) => {
		setError("");
		if (text && tokens(text) !== tokens(builtIn)) {
			setError(t("tokensChanged", { tokens: tokens(builtIn) || "—" }));
			return;
		}
		setBusy(true);
		const err = await send("PUT", "/text", { Locale: locale, Key: textKey, Text: text === builtIn ? "" : text });
		setBusy(false);
		if (err) return setError(err);
		setSaved(true);
		if (!text) setValue(builtIn);
		onSaved();
	};

	return (
		<TextRow $changed={override !== undefined}>
			<KeyCell>
				<code>{textKey}</code>
				{override !== undefined && <span className="badge">{t("changed")}</span>}
			</KeyCell>
			{korean && <Muted as="p" className="ko">{korean}</Muted>}
			<textarea
				value={value}
				rows={Math.min(6, Math.max(1, Math.ceil(value.length / 70)))}
				onChange={e => { setValue(e.target.value); setSaved(false); }}
				aria-label={textKey}
			/>
			<div className="actions">
				{override !== undefined && <Muted as="span" className="builtin">{t("builtIn")}: {builtIn}</Muted>}
				{override !== undefined && (
					<GhostButton type="button" disabled={busy} onClick={() => save("")}><RotateCcw size={14} aria-hidden /> {t("reset")}</GhostButton>
				)}
				<button type="button" disabled={busy || !dirty} onClick={() => save(value)}>{saved && !dirty ? t("saved") : t("save")}</button>
			</div>
			{error && <ErrorText role="alert">{error}</ErrorText>}
		</TextRow>
	);
}

function useSettingsSaver() {
	const router = useRouter();
	const t = useTranslations("admin.site");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [done, setDone] = useState(false);
	const save = async (settings: SiteSettings) => {
		setBusy(true);
		setError("");
		setDone(false);
		const err = await send("PUT", "/settings", settings);
		setBusy(false);
		if (err) return setError(err);
		setDone(true);
		router.refresh();
	};
	const status = (
		<>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			{done && <Muted as="p" role="status">{t("savedAll")}</Muted>}
		</>
	);
	return { busy, save, status };
}

function NoticeTab({ settings }: { settings: SiteSettings }) {
	const t = useTranslations("admin.site");
	const [notice, setNotice] = useState(settings.Notice);
	const { busy, save, status } = useSettingsSaver();
	return (
		<div>
			<Muted as="p">{t("noticeLead")}</Muted>
			<EditorGrid>
				<label className="check">
					<input type="checkbox" checked={notice.Enabled} onChange={e => setNotice({ ...notice, Enabled: e.target.checked })} /> {t("noticeOn")}
				</label>
				<label>
					{t("tone")}
					<select value={notice.Tone} onChange={e => setNotice({ ...notice, Tone: e.target.value as "info" | "warning" })}>
						<option value="info">{t("toneInfo")}</option>
						<option value="warning">{t("toneWarning")}</option>
					</select>
				</label>
				<label style={{ flex: 1 }}>
					{t("link")}
					<input type="text" value={notice.Link} placeholder="/safety" onChange={e => setNotice({ ...notice, Link: e.target.value })} />
				</label>
			</EditorGrid>
			{LOCALES.map(l => (
				<label key={l} style={{ display: "grid", gap: 4, marginBottom: 10 }}>
					<strong>{LOCALE_LABELS[l]}{l === "ko" ? ` (${t("required")})` : ""}</strong>
					<textarea rows={2} maxLength={300} value={notice.Text[l] ?? ""} onChange={e => setNotice({ ...notice, Text: { ...notice.Text, [l]: e.target.value } })} />
				</label>
			))}
			<button type="button" disabled={busy} onClick={() => save({ ...settings, Notice: notice })}>{t("save")}</button>
			{status}
		</div>
	);
}

function HomeTab({ settings }: { settings: SiteSettings }) {
	const t = useTranslations("admin.site");
	const [home, setHome] = useState(settings.Home);
	const [hero, setHero] = useState(settings.Hero);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");
	const { busy, save, status } = useSettingsSaver();

	const move = (i: number, by: number) => {
		const next = [...home];
		const [item] = next.splice(i, 1);
		next.splice(i + by, 0, item);
		setHome(next);
	};
	const upload = async (file: File | undefined) => {
		if (!file) return;
		setUploading(true);
		setError("");
		try {
			setHero((await uploadImages([file]))[0] ?? "");
		} catch (e) {
			setError(e instanceof Error ? e.message : libText("uploadFailed"));
		} finally {
			setUploading(false);
		}
	};

	return (
		<div>
			<h3>{t("sections")}</h3>
			<Muted as="p">{t("sectionsLead")}</Muted>
			<ol style={{ padding: 0, listStyle: "none" }}>
				{home.map((s, i) => (
					<SectionRow key={s.Id}>
						<label className="check">
							<input type="checkbox" checked={s.Enabled} onChange={e => setHome(home.map(x => (x.Id === s.Id ? { ...x, Enabled: e.target.checked } : x)))} />
							{t(`section.${s.Id as HomeSectionId}`)}
						</label>
						<GhostButton type="button" aria-label={t("up")} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></GhostButton>
						<GhostButton type="button" aria-label={t("down")} disabled={i === home.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></GhostButton>
					</SectionRow>
				))}
			</ol>
			<h3>{t("hero")}</h3>
			<Muted as="p">{t("heroLead")}</Muted>
			<div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "8px 0 16px" }}>
				{hero && <img src={hero} alt="" style={{ width: 96, height: 96, objectFit: "contain", border: "1px solid #dfe3f0", borderRadius: 10 }} />}
				<label className="upload">
					<GhostButton as="span">{uploading ? t("uploading") : t("chooseImage")}</GhostButton>
					<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" hidden onChange={e => upload(e.target.files?.[0])} />
				</label>
				{hero && <GhostButton type="button" onClick={() => setHero("")}>{t("useMascot")}</GhostButton>}
			</div>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<button type="button" disabled={busy || uploading} onClick={() => save({ ...settings, Home: home, Hero: hero })}>{t("save")}</button>
			{status}
		</div>
	);
}

function ThemeTab({ settings, tokens: list }: { settings: SiteSettings; tokens: ColorToken[] }) {
	const t = useTranslations("admin.site");
	const [theme, setTheme] = useState(settings.Theme);
	const { busy, save, status } = useSettingsSaver();
	return (
		<div>
			<Muted as="p">{t("themeLead")}</Muted>
			<TableWrap>
				<Table>
					<thead><tr><th>{t("token")}</th><th>{t("color")}</th><th>{t("builtIn")}</th><th></th></tr></thead>
					<tbody>
						{list.map(token => {
							const value = theme[token] ?? colors[token];
							return (
								<tr key={token}>
									<td>{t(`tokens.${token}`)} <Muted as="small">({token})</Muted></td>
									<td data-label={t("color")}>
										<Swatch>
											<input type="color" value={value} onChange={e => setTheme({ ...theme, [token]: e.target.value })} aria-label={token} />
											<code>{value}</code>
										</Swatch>
									</td>
									<td data-label={t("builtIn")}><Swatch><span style={{ background: colors[token] }} /><code>{colors[token]}</code></Swatch></td>
									<td>
										{theme[token] && (
											<GhostButton type="button" onClick={() => { const next = { ...theme }; delete next[token]; setTheme(next); }}>
												<RotateCcw size={14} aria-hidden /> {t("reset")}
											</GhostButton>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</Table>
			</TableWrap>
			<div style={{ marginTop: 12 }}>
				<button type="button" disabled={busy} onClick={() => save({ ...settings, Theme: theme })}>{t("save")}</button>
				{status}
			</div>
		</div>
	);
}

function LogTab({ log }: { log: LogEntry[] }) {
	const t = useTranslations("admin.site");
	const router = useRouter();
	const confirm = useConfirm();
	const locale = useLocale() as Locale;
	const [error, setError] = useState("");
	const revert = async (entry: LogEntry) => {
		if (!(await confirm({ title: t("revertTitle"), message: t("revertBody"), confirmLabel: t("revert") }))) return;
		const err = await send("POST", "/revert", { At: entry.At });
		if (err) return setError(err);
		router.refresh();
	};
	const short = (s: string) => (s.length > 80 ? `${s.slice(0, 80)}…` : s) || "—";
	// For settings, name the parts that differ instead of raw JSON.
	const parts = (e: LogEntry) => {
		const parse = (s: string) => { try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; } };
		const before = parse(e.Old);
		const after = parse(e.New);
		const changed = (["Notice", "Home", "Hero", "Theme"] as const).filter(k => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
		return changed.length ? t("changedParts", { parts: changed.map(k => t(`parts.${k}`)).join(", ") }) : t("nothing");
	};
	if (log.length === 0) return <Muted as="p">{t("noLog")}</Muted>;
	return (
		<div>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<TableWrap>
				<Table>
					<thead><tr><th>{t("when")}</th><th>{t("who")}</th><th>{t("what")}</th><th>{t("before")}</th><th>{t("after")}</th><th></th></tr></thead>
					<tbody>
						{log.map(e => (
							<tr key={e.At}>
								<td>{formatDateTime(e.At, locale)}</td>
								<td data-label={t("who")}>{e.Admin || "—"}</td>
								<td data-label={t("what")}><code>{e.Target === "settings" ? t("settingsTarget") : e.Target.replace(/^text:/, "")}</code></td>
								{e.Target === "settings"
									? <td colSpan={2}><small>{parts(e)}</small></td>
									: <>
										<td data-label={t("before")}><small>{short(e.Old)}</small></td>
										<td data-label={t("after")}><small>{short(e.New)}</small></td>
									</>}
								<td><GhostButton type="button" onClick={() => revert(e)}>{t("revert")}</GhostButton></td>
							</tr>
						))}
					</tbody>
				</Table>
			</TableWrap>
		</div>
	);
}
