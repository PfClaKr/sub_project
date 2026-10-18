'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
import type { Locale } from "@/i18n/config";
import { Bookmark, Eye, Map as MapIcon, MapPin, Phone, ShieldAlert } from "lucide-react";
import { DEALS, type ListingType } from "@/libs/constants";
import { gql, LISTING_DETAIL_FIELDS } from "@/libs/graphql";
import { formatDate, formatPrice } from "@/libs/format";
import { fetchArea, type Area } from "@/libs/geo";
import { expiryInfo, LISTING_PATH } from "@/libs/listing";
import { useSession } from "@/libs/session";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";
import { ChatButton } from "@/components/button/ChatButton";
import { ImageGallery } from "@/components/product/detail/ImageGallery";
import { PreviewMap } from "@/components/map";
import { LinkedText } from "@/components/community/Comments";
import { ReportButton } from "@/components/community/ReportButton";
import { BigPrice, Breadcrumb, DetailLayout, Description, Facts, InfoPanel, SideSlot } from "@/styles/styledDetail";
import { LocationSummary, MapBox } from "@/styles/styledLocation";
import { Meta, Tag, TextButton, ToggleButton } from "@/styles/styledCommunity";
import { OwnerPanel, SafetyBanner } from "@/styles/styledListing";
import { EmptyState, ErrorText, GhostButton, LinkButton, Muted, Skeleton } from "@/styles/styledUi";
import type { Post } from "@/libs/types";
import { TimeAgo } from "@/components/ui/TimeAgo";

const QUERY = `query Listing($id: String!) { listing(PostId: $id) { ${LISTING_DETAIL_FIELDS} } }`;

function HousingFacts({ post }: { post: Post }) {
	const t = useTranslations("listing.detail");
	const L = useLabels();
	const locale = useLocale() as Locale;
	const h = post.Housing!;
	const options = [h.Furnished && t("furnished"), h.Caf && t("caf"), h.Pets && t("pets")].filter(Boolean).join(" · ");
	return (
		<Facts>
			<dt>{h.Mode === "seek" ? t("budget") : t("rent")}</dt><dd>{L.rent(h)}</dd>
			{h.Deposit != null && <><dt>{t("deposit")}</dt><dd>{formatPrice(h.Deposit, locale)}</dd></>}
			<dt>{t("moveIn")}</dt><dd>{L.moveIn(h.AvailableFrom)}{h.EndDate ? ` ~ ${formatDate(Date.parse(h.EndDate), locale)}` : ""}</dd>
			{h.MinMonths ? <><dt>{t("minStay")}</dt><dd>{t("months", { count: h.MinMonths })}</dd></> : null}
			{(h.Size || h.Rooms) ? <><dt>{t("size")}</dt><dd>{[h.Size && `${h.Size}m²`, h.Rooms && t("rooms", { count: h.Rooms })].filter(Boolean).join(" · ")}</dd></> : null}
			{options && <><dt>{t("options")}</dt><dd>{options}</dd></>}
		</Facts>
	);
}

function JobFacts({ post }: { post: Post }) {
	const t = useTranslations("listing.detail");
	const L = useLabels();
	const j = post.Job!;
	return (
		<Facts>
			<dt>{t("pay")}</dt><dd>{L.wage(j)}</dd>
			<dt>{t("employment")}</dt><dd>{L.enum("employment", j.Employment)}</dd>
			{j.Schedule && <><dt>{t("schedule")}</dt><dd>{j.Schedule}</dd></>}
			{j.Languages && j.Languages.length > 0 && <><dt>{t("languages")}</dt><dd>{j.Languages.map(l => L.enum("jobLanguage", l)).join(", ")}</dd></>}
			<dt>{t("permit")}</dt><dd>{j.PermitRequired ? t("permitRequired") : t("permitNone")}</dd>
		</Facts>
	);
}

// ContactReveal shows an employer's phone/email on demand (counted on the
// server) instead of printing it in the page for scrapers.
function ContactReveal({ postId }: { postId: string }) {
	const t = useTranslations("listing.detail");
	const { session } = useSession();
	const router = useRouter();
	const pathname = usePathname();
	const [contact, setContact] = useState<{ Phone?: string; Email?: string } | null>(null);
	const [error, setError] = useState("");

	const reveal = async () => {
		if (!session) {
			router.push(`/login?next=${encodeURIComponent(pathname)}`);
			return;
		}
		const { data, error } = await gql<{ revealContact: { Phone: string; Email: string } }>(
			`mutation($id: String!) { revealContact(PostId: $id) { Phone Email } }`,
			{ id: postId },
		);
		if (error) setError(error);
		else setContact(data?.revealContact ?? null);
	};

	if (contact) {
		return (
			<Muted as="p" style={{ margin: 0 }}>
				{contact.Phone && <><a href={`tel:${contact.Phone.replace(/\s/g, "")}`}>{contact.Phone}</a><br /></>}
				{contact.Email && <a href={`mailto:${contact.Email}`}>{contact.Email}</a>}
			</Muted>
		);
	}
	return (
		<>
			<GhostButton type="button" onClick={reveal}><Phone size={15} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />{t("showContact")}</GhostButton>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

function ListingLocation({ post }: { post: Post }) {
	const t = useTranslations("listing.detail");
	const L = useLabels();
	const [area, setArea] = useState<Area | null>(null);
	const exact = !!post.ExactLocation;
	useEffect(() => {
		if (!exact && post.AreaId) fetchArea(post.AreaId).then(setArea).catch(() => {});
	}, [exact, post.AreaId]);
	if (!post.Latitude || !post.Longitude) return null;
	const point = { lat: post.Latitude, lng: post.Longitude };
	return (
		<Description aria-label={t("location")}>
			<h2>{t("location")}</h2>
			<MapBox $h={260}>
				<PreviewMap pin={exact || !post.AreaId ? point : null} area={area} />
			</MapBox>
			<LocationSummary>
				{exact ? <MapPin size={16} aria-hidden /> : <MapIcon size={16} aria-hidden />}
				<span>{exact ? post.AreaName : t("exactInChat", { area: post.AreaName ?? L.enum("region", post.City) })}</span>
			</LocationSummary>
		</Description>
	);
}

function Owner({ post, onChange }: { post: Post; onChange: (p: Post) => void }) {
	const t = useTranslations("listing.detail");
	const c = useTranslations("common");
	const L = useLabels();
	const router = useRouter();
	const confirm = useConfirm();
	const [error, setError] = useState("");
	const exp = expiryInfo(post);
	const type = post.Type as ListingType;

	const run = async (mutation: string, vars: Record<string, unknown> = {}) => {
		setError("");
		const { data, error } = await gql<Record<string, Post>>(mutation, { id: post.PostId, ...vars });
		if (error) setError(error);
		else if (data) onChange({ ...post, ...Object.values(data)[0] });
	};

	const remove = async () => {
		if (!(await confirm({ title: t("deleteTitle"), message: t("deleteBody"), danger: true, confirmLabel: c("delete") }))) return;
		const { error } = await gql(`mutation($id: String!) { deletePost(PostId: $id) }`, { id: post.PostId });
		if (error) return setError(error);
		router.push(LISTING_PATH[type]);
		router.refresh();
	};

	return (
		<OwnerPanel aria-label={t("manage")}>
			<div>
				<strong>{t("manage")}</strong>
				<Muted>{exp.expired ? t("expired") : t("expiresIn", { days: exp.daysLeft })}</Muted>
			</div>
			<div>
				<label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{t("status")}
					<select value={post.Deal} onChange={e => run(`mutation($id: String!, $d: String!) { setListingDeal(PostId: $id, Deal: $d) { Deal } }`, { d: e.target.value })}>
						{DEALS.map(d => <option key={d.value} value={d.value}>{L.deal(d.value)}</option>)}
					</select>
				</label>
				{!exp.expired && post.Deal !== "closed" && (
					<GhostButton type="button" onClick={() => run(`mutation($id: String!) { bumpListing(PostId: $id) { BumpedAt } }`)}>{t("bump")}</GhostButton>
				)}
				{exp.extendable && (
					<GhostButton type="button" onClick={() => run(`mutation($id: String!) { extendListing(PostId: $id) { ExpiresAt Status } }`)}>{t("extend")}</GhostButton>
				)}
				<LinkButton href={`${LISTING_PATH[type]}/${post.PostId}/edit`} $ghost>{c("edit")}</LinkButton>
				<TextButton type="button" $danger onClick={remove}>{c("delete")}</TextButton>
			</div>
			{error && <ErrorText role="alert">{error}</ErrorText>}
		</OwnerPanel>
	);
}

// ListingDetail renders a housing or job post. Like the community page,
// the server passes the public version and it is re-read with the cookie.
export function ListingDetail({ type, postId, initial }: { type: ListingType; postId: string; initial: Post | null }) {
	const t = useTranslations("listing.detail");
	const c = useTranslations("common");
	const L = useLabels();
	const { session } = useSession();
	const router = useRouter();
	const pathname = usePathname();
	const [post, setPost] = useState<Post | null>(initial);
	const [missing, setMissing] = useState(false);
	const [error, setError] = useState("");
	const viewed = useRef(false);

	const reload = useCallback(async () => {
		const { data, error } = await gql<{ listing: Post | null }>(QUERY, { id: postId });
		if (error) setError(error);
		else if (!data?.listing || data.listing.Type !== type) setMissing(true);
		else setPost(data.listing);
	}, [postId, type]);

	useEffect(() => {
		reload();
	}, [reload, session?.UserId]);

	// Count one view per page open (refs survive StrictMode's re-run).
	useEffect(() => {
		if (viewed.current) return;
		viewed.current = true;
		gql(`mutation($id: String!) { viewPost(PostId: $id) }`, { id: postId });
	}, [postId]);

	if (missing) {
		return (
			<EmptyState>
				<p>{t("missing")}</p>
				<LinkButton href={LISTING_PATH[type]}>{t("backToList")}</LinkButton>
			</EmptyState>
		);
	}
	if (!post) return <Skeleton $h="420px" />;

	const toggleBookmark = async () => {
		if (!session) return router.push(`/login?next=${encodeURIComponent(pathname)}`);
		const on = !post.Bookmarked;
		const { error } = await gql(`mutation($id: String!, $on: Boolean!) { bookmarkPost(PostId: $id, On: $on) }`, { id: post.PostId, on });
		if (error) setError(error);
		else setPost({ ...post, Bookmarked: on });
	};

	const h = post.Housing;
	const j = post.Job;
	const kindGroup = type === "housing" ? "housingKind" : "jobSector";
	const closed = post.Deal === "closed" || post.Status === "expired";

	return (
		<div>
			<Breadcrumb aria-label={c("breadcrumb")}>
				<Link href={LISTING_PATH[type]}>{L.board(type)}</Link>
				{post.Topic && <> › <Link href={`${LISTING_PATH[type]}?kind=${encodeURIComponent(post.Topic)}`}>{L.enum(kindGroup, post.Topic)}</Link></>}
			</Breadcrumb>
			<DetailLayout>
				{post.Images && post.Images.length > 0
					? <ImageGallery images={post.Images} name={post.Title} />
					: <SideSlot $afterOnMobile><ListingLocation post={post} /></SideSlot>}
				<InfoPanel>
					<Meta>
						<Link href={`${LISTING_PATH[type]}?mode=${h?.Mode ?? j?.Mode}`}><Tag>{L.mode(type, h?.Mode ?? j?.Mode)}</Tag></Link>
						<span>{L.enum(kindGroup, post.Topic)}</span>
						{post.Deal !== "open" && <Tag $tone={post.Deal === "closed" ? "done" : "warning"}>{L.deal(post.Deal)}</Tag>}
						{post.Status === "expired" && <Tag $tone="warning">{t("expiredTag")}</Tag>}
						{post.Status === "hidden" && <Tag $tone="warning">{t("hidden")}</Tag>}
					</Meta>
					<h1>{post.Title}</h1>
					<BigPrice>{h ? L.rent(h) : j ? L.wage(j) : ""}</BigPrice>
					{h ? <HousingFacts post={post} /> : j ? <JobFacts post={post} /> : null}
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<Avatar src={post.AuthorImage} name={post.AuthorNickname} size={36} />
						<div style={{ flex: 1 }}>
							{post.AuthorId ? <Link href={`/user/${post.AuthorId}`}><strong>{L.name(post.AuthorNickname)}</strong></Link> : <strong>{L.name(post.AuthorNickname)}</strong>}
							<Meta>
								<span><TimeAgo ts={Math.max(post.BumpedAt ?? 0, post.CreatedAt)} /></span>
								<span><Eye size={13} aria-hidden /> {post.ViewCount ?? 0}</span>
							</Meta>
						</div>
						{!post.IsMine && <ReportButton target={{ type: "post", id: post.PostId }} />}
					</div>

					{post.IsMine ? (
						<Owner post={post} onChange={setPost} />
					) : (
						<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
							<ChatButton
								subject={{ type, id: post.PostId }}
								disabled={closed}
								disabledLabel={post.Status === "expired" ? t("expiredPost") : t("closedPost")}
								label={type === "housing" ? t("askChat") : j?.Mode === "hiring" ? t("applyChat") : t("chat")}
							/>
							<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
								<ToggleButton type="button" $on={post.Bookmarked} aria-pressed={!!post.Bookmarked} onClick={toggleBookmark}>
									<Bookmark size={16} fill={post.Bookmarked ? "currentColor" : "none"} aria-hidden /> {post.Bookmarked ? t("saved") : t("save")}
								</ToggleButton>
								{post.HasContact && <ContactReveal postId={post.PostId} />}
							</div>
						</div>
					)}
					{error && <ErrorText role="alert">{error}</ErrorText>}

					<SafetyBanner>
						<ShieldAlert size={18} aria-hidden />
						<span>
							{t(type === "housing" ? "safetyHousing" : "safetyJob")}
							{" "}<Link href="/safety">{t("guide")}</Link>
						</span>
					</SafetyBanner>
				</InfoPanel>
			</DetailLayout>

			<Description aria-label={t("about")}>
				<h2>{t("about")}</h2>
				<p><LinkedText text={post.Body ?? ""} /></p>
			</Description>
			{post.Images && post.Images.length > 0 && <ListingLocation post={post} />}
		</div>
	);
}
