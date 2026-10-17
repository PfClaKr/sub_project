'use client';

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { List, Map as MapIcon, MapPin, Search, ShieldAlert, SlidersHorizontal, SquarePen } from "lucide-react";
import { EMPLOYMENT_TYPES, HOUSING_KINDS, JOB_SECTORS, LISTING_MODES, type ListingType } from "@/libs/constants";
import { gql, LISTING_CARD_FIELDS } from "@/libs/graphql";
import { distanceLabel } from "@/libs/geo";
import { LISTING_PATH, listingHref, listingVariables, parseListingParams, rentLabel, wageLabel, type ListingParams } from "@/libs/listing";
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

const TEXT = {
	housing: {
		title: "집 구하기",
		kinds: HOUSING_KINDS as readonly string[],
		search: "동네, 역, 조건으로 검색 (예: 15구 쉐어)",
		sorts: [{ v: "", l: "최신순" }, { v: "rent_asc", l: "월세 낮은순" }, { v: "available", l: "입주 빠른순" }],
		write: "방 올리기",
		empty: "조건에 맞는 방이 없어요.",
	},
	job: {
		title: "알바·구인구직",
		kinds: JOB_SECTORS as readonly string[],
		search: "업종, 동네로 검색 (예: 카페 주말)",
		sorts: [{ v: "", l: "최신순" }, { v: "wage_desc", l: "급여 높은순" }],
		write: "구인·구직 올리기",
		empty: "조건에 맞는 글이 없어요.",
	},
};

// ListingBoard lists housing or job posts. Filters live in the URL like
// the product search; the region comes from the shared region chip.
export function ListingBoard({ type }: { type: ListingType }) {
	const sp = useSearchParams();
	const router = useRouter();
	const { session } = useSession();
	const { city } = useRegion();
	const params = parseListingParams(type, sp);
	const key = sp.toString();
	const text = TEXT[type];

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
			if (error || !data) setError(error ?? "글을 불러오지 못했어요.");
			else setData(data.listings);
		});
		return () => {
			alive = false;
		};
	}, [key, city, type]);

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
	const sorts = hasPlace ? [...text.sorts, { v: "distance", l: "가까운순" }] : text.sorts;

	const mapItems: MapItem[] = (data?.Items ?? [])
		.filter(p => p.Latitude && p.Longitude)
		.map(p => ({
			id: p.PostId, lat: p.Latitude!, lng: p.Longitude!, title: p.Title,
			href: `${LISTING_PATH[type]}/${p.PostId}`,
			label: p.Housing ? rentLabel(p.Housing).split(" · ")[0] : p.Job ? wageLabel(p.Job) : "",
		}));

	return (
		<div>
			<BoardHeader>
				<h1>{text.title}</h1>
				<LinkButton href={session ? writeHref : `/login?next=${encodeURIComponent(writeHref)}`}>
					<SquarePen size={16} aria-hidden style={{ marginRight: 6, verticalAlign: -3 }} />{text.write}
				</LinkButton>
			</BoardHeader>

			<ChipRow aria-label="글 종류" style={{ marginBottom: 12 }}>
				<Chip href={listingHref(type, params, { mode: undefined })} $active={!params.mode}>전체</Chip>
				{LISTING_MODES[type].map(m => (
					<Chip key={m.value} href={listingHref(type, params, { mode: m.value })} $active={params.mode === m.value}>{m.label}</Chip>
				))}
			</ChipRow>
			<ChipRow aria-label={type === "housing" ? "집 형태" : "업종"} style={{ marginBottom: 12 }}>
				<Chip href={listingHref(type, params, { kind: undefined })} $active={!params.kind}>{type === "housing" ? "모든 형태" : "모든 업종"}</Chip>
				{text.kinds.map(k => (
					<Chip key={k} href={listingHref(type, params, { kind: k })} $active={params.kind === k}>{k}</Chip>
				))}
			</ChipRow>

			<Toolbar>
				<RegionChip />
				<form role="search" onSubmit={onSearch}>
					<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={text.search} aria-label="검색" maxLength={100} />
					<GhostButton type="submit" aria-label="검색"><Search size={16} /></GhostButton>
				</form>
				<Popover>
					<FilterButton $on={filterCount > 0} onClick={() => setFiltersOpen(o => !o)} aria-expanded={filtersOpen}>
						<SlidersHorizontal size={16} /> 조건{filterCount > 0 ? ` ${filterCount}` : ""}
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
						<MapPin size={16} /> {hasPlace ? `${params.place ?? "선택한 위치"} · ${distanceLabel(params.km ?? 0)}` : "위치"}
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
				<select aria-label="정렬" value={params.sort ?? ""} onChange={e => go({ sort: e.target.value || undefined })}>
					{sorts.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
				</select>
				<ViewToggle role="group" aria-label="보기">
					<button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={15} /> 목록</button>
					<button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}><MapIcon size={15} /> 지도</button>
				</ViewToggle>
			</Toolbar>

			<SafetyBanner style={{ marginBottom: 16 }}>
				<ShieldAlert size={18} aria-hidden />
				<span>
					{type === "housing"
						? "집을 직접 보고 계약서를 쓰기 전에는 보증금이나 월세를 보내지 마세요."
						: "신분증·계좌 정보를 먼저 요구하거나, 일을 시작하기 전에 돈을 요구하면 사기예요."}
					{" "}<Link href="/safety">안전 가이드</Link>
				</span>
			</SafetyBanner>

			{error && <ErrorText role="alert">{error}</ErrorText>}
			{!error && !data && <PostListSkeleton />}
			{data?.Corrected && <Muted as="p">정확히 맞는 글이 없어 비슷한 글을 보여드려요.</Muted>}
			{data && data.Items.length === 0 && (
				<EmptyState>
					<p>{text.empty}</p>
					<LinkButton href={writeHref}>{text.write}</LinkButton>
				</EmptyState>
			)}
			{data && data.Items.length > 0 && (view === "map"
				? <MapPanel><ListingsMap items={mapItems} /></MapPanel>
				: <ListingList posts={data.Items} />)}

			{data && data.TotalPages > 1 && (
				<Pagination aria-label="페이지">
					{data.Page > 1 && <LinkButton href={listingHref(type, params, { page: data.Page - 1 })} $ghost>← 이전</LinkButton>}
					<span>{data.Page} / {data.TotalPages}</span>
					{data.Page < data.TotalPages && <LinkButton href={listingHref(type, params, { page: data.Page + 1 })} $ghost>다음 →</LinkButton>}
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
	const [f, setF] = useState<ListingParams>(initial);
	const set = (patch: Partial<ListingParams>) => setF(prev => ({ ...prev, ...patch }));
	const num = (v: string) => (v ? Number(v) : undefined);

	return (
		<PopoverPanel role="dialog" aria-label="조건">
			{type === "housing" ? (
				<>
					<TwoColumns>
						<FieldLabel>최대 월세
							<Adorned>
								<span aria-hidden>€</span>
								<input type="number" min={0} inputMode="numeric" value={f.max ?? ""} onChange={e => set({ max: num(e.target.value) })} placeholder="제한 없음" />
							</Adorned>
						</FieldLabel>
						<FieldLabel>입주 가능일
							<input type="date" value={f.by ?? ""} onChange={e => set({ by: e.target.value || undefined })} />
						</FieldLabel>
					</TwoColumns>
					<CheckRow>
						<label><input type="checkbox" checked={!!f.furnished} onChange={e => set({ furnished: e.target.checked || undefined })} /> 가구 포함</label>
						<label><input type="checkbox" checked={!!f.caf} onChange={e => set({ caf: e.target.checked || undefined })} /> CAF 가능</label>
						<label><input type="checkbox" checked={!!f.pets} onChange={e => set({ pets: e.target.checked || undefined })} /> 반려동물</label>
					</CheckRow>
				</>
			) : (
				<>
					<TwoColumns>
						<FieldLabel>고용 형태
							<select value={f.employment ?? ""} onChange={e => set({ employment: e.target.value || undefined })}>
								<option value="">전체</option>
								{EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
							</select>
						</FieldLabel>
						<FieldLabel>최소 시급
							<Adorned>
								<span aria-hidden>€</span>
								<input type="number" min={0} step={0.1} inputMode="decimal" value={f.minwage ?? ""} onChange={e => set({ minwage: num(e.target.value) })} placeholder="제한 없음" />
							</Adorned>
						</FieldLabel>
					</TwoColumns>
					<CheckRow>
						<label><input type="checkbox" checked={!!f.permitfree} onChange={e => set({ permitfree: e.target.checked || undefined })} /> 체류증 조건 없는 일만</label>
					</CheckRow>
				</>
			)}
			<PanelActions>
				<GhostButton type="button" onClick={() => onApply(type === "housing"
					? { max: undefined, by: undefined, furnished: undefined, caf: undefined, pets: undefined }
					: { minwage: undefined, permitfree: undefined, employment: undefined })}>초기화</GhostButton>
				<div style={{ display: "flex", gap: 8 }}>
					<GhostButton type="button" onClick={onClose}>닫기</GhostButton>
					<button type="button" onClick={() => onApply(type === "housing"
						? { max: f.max, by: f.by, furnished: f.furnished, caf: f.caf, pets: f.pets }
						: { minwage: f.minwage, permitfree: f.permitfree, employment: f.employment })}>적용</button>
				</div>
			</PanelActions>
		</PopoverPanel>
	);
}
