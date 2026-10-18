'use client';

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
import { List, Map as MapIcon, MapPin, Search, ShieldAlert, SlidersHorizontal, SquarePen } from "lucide-react";
import { EMPLOYMENT_TYPES, HOUSING_KINDS, JOB_SECTORS, LISTING_MODES, type ListingType } from "@/libs/constants";
import { gql, LISTING_CARD_FIELDS } from "@/libs/graphql";
import { LISTING_PATH, listingHref, listingVariables, parseListingParams, type ListingParams } from "@/libs/listing";
import { useRegion } from "@/libs/region";
import { useSession } from "@/libs/session";
import { ListingsMap, type MapItem } from "@/components/map";
import { LocationFilterPanel } from "@/components/search/SearchControls";
import { RegionChip } from "@/components/community/RegionChip";
import { PostListSkeleton } from "@/components/community/PostList";
import { FieldLabel, TwoColumns, Adorned } from "@/styles/styledForm";
import { Chip, ChipRow, EmptyState, ErrorText, GhostButton, LinkButton, Muted, Pagination } from "@/styles/styledUi";
import { BoardHeader, Toolbar } from "@/styles/styledCommunity";
import { FilterButton, PanelActions, Popover, PopoverPanel } from "@/styles/styledSearch";
import { CheckRow, MapPanel, SafetyBanner, ViewToggle } from "@/styles/styledListing";
import { ListingList } from "./ListingRow";
import type { PostPage } from "@/libs/types";

const QUERY = `query Listings($type: String!, $city: String, $q: String, $housing: HousingFilter, $job: JobFilter,
	$area: String, $lat: Float, $lng: Float, $km: Float, $sort: String, $page: Int) {
	listings(Type: $type, City: $city, Q: $q, Housing: $housing, Job: $job, AreaId: $area, Latitude: $lat, Longitude: $lng,
		DistanceKm: $km, Sort: $sort, Page: $page) {
		Items { ${LISTING_CARD_FIELDS} } Page TotalPages Total Corrected
	}
}`;

// Texts: listing.board.<type>.* for what differs between the boards.
const KINDS = { housing: HOUSING_KINDS as readonly string[], job: JOB_SECTORS as readonly string[] };
const SORTS = { housing: [["", "newest"], ["rent_asc", "rentAsc"], ["available", "available"]], job: [["", "newest"], ["wage_desc", "wageDesc"]] } as const;

// ListingBoard lists housing or job posts. Filters live in the URL like
// the product search; the region comes from the shared region chip.
export function ListingBoard({ type }: { type: ListingType }) {
	const t = useTranslations("listing.board");
	const c = useTranslations("common");
	const L = useLabels();
	const sp = useSearchParams();
	const router = useRouter();
	const { session } = useSession();
	const { city } = useRegion();
	const params = parseListingParams(type, sp);
	const key = sp.toString();

	const [data, setData] = useState<PostPage | null>(null);
	const [error, setError] = useState("");
	const [query, setQuery] = useState(params.q ?? "");
	const [view, setView] = useState<"list" | "map">("list");
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [placeOpen, setPlaceOpen] = useState(false);

	useEffect(() => {
		let alive = true;
		setData(null);
		setError("");
		const p = parseListingParams(type, new URLSearchParams(key));
		gql<{ listings: PostPage }>(QUERY, listingVariables(type, p, city)).then(({ data, error }) => {
			if (!alive) return;
			if (error || !data) setError(error ?? t("loadError"));
			else setData(data.listings);
		});
		return () => {
			alive = false;
		};
	}, [key, city, type, t]);

	useEffect(() => setQuery(parseListingParams(type, new URLSearchParams(key)).q ?? ""), [key, type]);

	const go = (change: Partial<ListingParams>) => router.push(listingHref(type, params, change), { scroll: false });
	const onSearch = (e: FormEvent) => {
		e.preventDefault();
		go({ q: query.trim() || undefined });
	};
	const writeHref = `${LISTING_PATH[type]}/write`;
	const hasPlace = !!params.area || params.lat !== undefined;
	const filterCount = type === "housing"
		? [params.max, params.by, params.furnished, params.caf, params.pets].filter(Boolean).length
		: [params.minwage, params.permitfree, params.employment].filter(Boolean).length;
	const sorts: (readonly [string, string])[] = hasPlace ? [...SORTS[type], ["distance", "distance"]] : [...SORTS[type]];

	const mapItems: MapItem[] = (data?.Items ?? [])
		.filter(p => p.Latitude && p.Longitude)
		.map(p => ({
			id: p.PostId, lat: p.Latitude!, lng: p.Longitude!, title: p.Title,
			href: `${LISTING_PATH[type]}/${p.PostId}`,
			label: p.Housing ? L.rent({ ...p.Housing, ChargesIncluded: false }) : p.Job ? L.wage(p.Job) : "",
		}));

	return (
		<div>
			<BoardHeader>
				<h1>{t(`${type}.title`)}</h1>
				<LinkButton href={session ? writeHref : `/login?next=${encodeURIComponent(writeHref)}`}>
					<SquarePen size={16} aria-hidden style={{ marginRight: 6, verticalAlign: -3 }} />{t(`${type}.write`)}
				</LinkButton>
			</BoardHeader>

			<ChipRow aria-label={t("modesLabel")} style={{ marginBottom: 12 }}>
				<Chip href={listingHref(type, params, { mode: undefined })} $active={!params.mode}>{t("all")}</Chip>
				{LISTING_MODES[type].map(m => (
					<Chip key={m.value} href={listingHref(type, params, { mode: m.value })} $active={params.mode === m.value}>{L.mode(type, m.value)}</Chip>
				))}
			</ChipRow>
			<ChipRow aria-label={t(`${type}.kindsLabel`)} style={{ marginBottom: 12 }}>
				<Chip href={listingHref(type, params, { kind: undefined })} $active={!params.kind}>{t(`${type}.allKinds`)}</Chip>
				{KINDS[type].map(k => (
					<Chip key={k} href={listingHref(type, params, { kind: k })} $active={params.kind === k}>{L.enum(type === "housing" ? "housingKind" : "jobSector", k)}</Chip>
				))}
			</ChipRow>

			<Toolbar>
				<RegionChip />
				<form role="search" onSubmit={onSearch}>
					<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t(`${type}.search`)} aria-label={c("search")} maxLength={100} />
					<GhostButton type="submit" aria-label={c("search")}><Search size={16} /></GhostButton>
				</form>
				<Popover>
					<FilterButton $on={filterCount > 0} onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}>
						<SlidersHorizontal size={16} /> {t("filters")}{filterCount > 0 ? ` ${filterCount}` : ""}
					</FilterButton>
					{filtersOpen && (
						<ListingFilterPanel
							type={type}
							initial={params}
							onClose={() => setFiltersOpen(false)}
							onApply={change => { setFiltersOpen(false); go(change); }}
						/>
					)}
				</Popover>
				<Popover>
					<FilterButton $on={hasPlace} onClick={() => setPlaceOpen(o => !o)} aria-expanded={placeOpen}>
						<MapPin size={16} /> {hasPlace ? `${params.place ?? t("chosenPlace")} · ${L.distance(params.km ?? 0)}` : t("place")}
					</FilterButton>
					{placeOpen && (
						<LocationFilterPanel
							initial={hasPlace ? {
								areaId: params.area ?? null, km: params.km ?? 0, name: params.place ?? "",
								center: params.lat !== undefined && params.lng !== undefined ? { lat: params.lat, lng: params.lng } : null,
							} : null}
							onClose={() => setPlaceOpen(false)}
							onApply={f => {
								setPlaceOpen(false);
								if (f) {
									go({
										area: f.area?.AreaId, place: f.name, lat: Number(f.center.lat.toFixed(5)), lng: Number(f.center.lng.toFixed(5)),
										km: f.km || undefined, sort: params.sort ?? "distance",
									});
								} else {
									go({ area: undefined, place: undefined, lat: undefined, lng: undefined, km: undefined, sort: params.sort === "distance" ? undefined : params.sort });
								}
							}}
						/>
					)}
				</Popover>
				<select aria-label={t("sort")} value={params.sort ?? ""} onChange={e => go({ sort: e.target.value || undefined })}>
					{sorts.map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}
				</select>
				<ViewToggle role="group" aria-label={t("view")}>
					<button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={15} /> {t("list")}</button>
					<button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}><MapIcon size={15} /> {t("map")}</button>
				</ViewToggle>
			</Toolbar>

			<SafetyBanner style={{ marginBottom: 16 }}>
				<ShieldAlert size={18} aria-hidden />
				<span>
					{t(`${type}.safety`)}
					{" "}<Link href="/safety">{t("guide")}</Link>
				</span>
			</SafetyBanner>

			{error && <ErrorText role="alert">{error}</ErrorText>}
			{!error && !data && <PostListSkeleton />}
			{data?.Corrected && <Muted as="p">{t("corrected")}</Muted>}
			{data && data.Items.length === 0 && (
				<EmptyState>
					<p>{t(`${type}.empty`)}</p>
					<LinkButton href={writeHref}>{t(`${type}.write`)}</LinkButton>
				</EmptyState>
			)}
			{data && data.Items.length > 0 && (view === "map"
				? <MapPanel><ListingsMap items={mapItems} /></MapPanel>
				: <ListingList posts={data.Items} />)}

			{data && data.TotalPages > 1 && (
				<Pagination aria-label={t("pages")}>
					{data.Page > 1 && <LinkButton href={listingHref(type, params, { page: data.Page - 1 })} $ghost>{c("prev")}</LinkButton>}
					<span>{data.Page} / {data.TotalPages}</span>
					{data.Page < data.TotalPages && <LinkButton href={listingHref(type, params, { page: data.Page + 1 })} $ghost>{c("next")}</LinkButton>}
				</Pagination>
			)}
		</div>
	);
}

function ListingFilterPanel({ type, initial, onApply, onClose }: {
	type: ListingType;
	initial: ListingParams;
	onApply: (change: Partial<ListingParams>) => void;
	onClose: () => void;
}) {
	const t = useTranslations("listing.board");
	const c = useTranslations("common");
	const L = useLabels();
	const [f, setF] = useState<ListingParams>(initial);
	const set = (patch: Partial<ListingParams>) => setF(prev => ({ ...prev, ...patch }));
	const num = (v: string) => (v ? Number(v) : undefined);

	return (
		<PopoverPanel role="dialog" aria-label={t("filters")}>
			{type === "housing" ? (
				<>
					<TwoColumns>
						<FieldLabel>{t("maxRent")}
							<Adorned>
								<span aria-hidden>€</span>
								<input type="number" min={0} inputMode="numeric" value={f.max ?? ""} onChange={e => set({ max: num(e.target.value) })} placeholder={t("noLimit")} />
							</Adorned>
						</FieldLabel>
						<FieldLabel>{t("moveInBy")}
							<input type="date" value={f.by ?? ""} onChange={e => set({ by: e.target.value || undefined })} />
						</FieldLabel>
					</TwoColumns>
					<CheckRow>
						<label><input type="checkbox" checked={!!f.furnished} onChange={e => set({ furnished: e.target.checked || undefined })} /> {t("furnished")}</label>
						<label><input type="checkbox" checked={!!f.caf} onChange={e => set({ caf: e.target.checked || undefined })} /> {t("caf")}</label>
						<label><input type="checkbox" checked={!!f.pets} onChange={e => set({ pets: e.target.checked || undefined })} /> {t("pets")}</label>
					</CheckRow>
				</>
			) : (
				<>
					<TwoColumns>
						<FieldLabel>{t("employment")}
							<select value={f.employment ?? ""} onChange={e => set({ employment: e.target.value || undefined })}>
								<option value="">{t("all")}</option>
								{EMPLOYMENT_TYPES.map(e => <option key={e} value={e}>{L.enum("employment", e)}</option>)}
							</select>
						</FieldLabel>
						<FieldLabel>{t("minWage")}
							<Adorned>
								<span aria-hidden>€</span>
								<input type="number" min={0} step={0.1} inputMode="decimal" value={f.minwage ?? ""} onChange={e => set({ minwage: num(e.target.value) })} placeholder={t("noLimit")} />
							</Adorned>
						</FieldLabel>
					</TwoColumns>
					<CheckRow>
						<label><input type="checkbox" checked={!!f.permitfree} onChange={e => set({ permitfree: e.target.checked || undefined })} /> {t("permitFree")}</label>
					</CheckRow>
				</>
			)}
			<PanelActions>
				<GhostButton type="button" onClick={() => onApply(type === "housing"
					? { max: undefined, by: undefined, furnished: undefined, caf: undefined, pets: undefined }
					: { minwage: undefined, permitfree: undefined, employment: undefined })}>{t("reset")}</GhostButton>
				<div style={{ display: "flex", gap: 8 }}>
					<GhostButton type="button" onClick={onClose}>{c("close")}</GhostButton>
					<button type="button" onClick={() => onApply(type === "housing"
						? { max: f.max, by: f.by, furnished: f.furnished, caf: f.caf, pets: f.pets }
						: { minwage: f.minwage, permitfree: f.permitfree, employment: f.employment })}>{t("apply")}</button>
				</div>
			</PanelActions>
		</PopoverPanel>
	);
}
