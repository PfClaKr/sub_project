'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bookmark, Eye, Map as MapIcon, MapPin, Phone, ShieldAlert } from "lucide-react";
import { DEALS, type ListingType } from "@/libs/constants";
import { gql, LISTING_DETAIL_FIELDS } from "@/libs/graphql";
import { formatDate, formatPrice, formatRelative } from "@/libs/format";
import { fetchArea, type Area } from "@/libs/geo";
import { dealLabel, expiryInfo, LISTING_PATH, modeLabel, moveInLabel, rentLabel, wageLabel } from "@/libs/listing";
import { useSession } from "@/libs/session";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";
import { ChatButton } from "@/components/button/ChatButton";
import { ImageGallery } from "@/components/product/detail/ImageGallery";
import { PreviewMap } from "@/components/map";
import { LinkedText } from "@/components/community/Comments";
import { ReportButton } from "@/components/community/ReportButton";
import { BigPrice, DetailLayout, Description, Facts, InfoPanel } from "@/styles/styledDetail";
import { LocationSummary, MapBox } from "@/styles/styledLocation";
import { Meta, Tag, TextButton, ToggleButton } from "@/styles/styledCommunity";
import { OwnerPanel, SafetyBanner } from "@/styles/styledListing";
import { EmptyState, ErrorText, GhostButton, LinkButton, Muted, Skeleton } from "@/styles/styledUi";
import type { Post } from "@/libs/types";

const QUERY = `query Listing($id: String!) { listing(PostId: $id) { ${LISTING_DETAIL_FIELDS} } }`;

function HousingFacts({ post }: { post: Post }) {
	const h = post.Housing!;
	const options = [h.Furnished && "가구 포함", h.Caf && "CAF 가능", h.Pets && "반려동물 가능"].filter(Boolean).join(" · ");
	return (
		<Facts>
			<dt>{h.Mode === "seek" ? "예산" : "월세"}</dt><dd>{rentLabel(h)}</dd>
			{h.Deposit != null && <><dt>보증금</dt><dd>{formatPrice(h.Deposit)}</dd></>}
			<dt>입주</dt><dd>{moveInLabel(h.AvailableFrom)}{h.EndDate ? ` ~ ${formatDate(Date.parse(h.EndDate))}` : ""}</dd>
			{h.MinMonths ? <><dt>최소 기간</dt><dd>{h.MinMonths}개월</dd></> : null}
			{(h.Size || h.Rooms) ? <><dt>크기</dt><dd>{[h.Size && `${h.Size}m²`, h.Rooms && `방 ${h.Rooms}개`].filter(Boolean).join(" · ")}</dd></> : null}
			{options && <><dt>옵션</dt><dd>{options}</dd></>}
		</Facts>
	);
}

function JobFacts({ post }: { post: Post }) {
	const j = post.Job!;
	return (
		<Facts>
			<dt>급여</dt><dd>{wageLabel(j)}</dd>
			<dt>고용 형태</dt><dd>{j.Employment}</dd>
			{j.Schedule && <><dt>근무</dt><dd>{j.Schedule}</dd></>}
			{j.Languages && j.Languages.length > 0 && <><dt>언어</dt><dd>{j.Languages.join(", ")}</dd></>}
			<dt>체류증</dt><dd>{j.PermitRequired ? "근로 가능한 체류증 필요" : "조건 없음"}</dd>
		</Facts>
	);
}

// ContactReveal shows an employer's phone/email on demand (counted on the
// server) instead of printing it in the page for scrapers.
function ContactReveal({ postId }: { postId: string }) {
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
			<GhostButton type="button" onClick={reveal}><Phone size={15} aria-hidden style={{ verticalAlign: -2, marginRight: 6 }} />연락처 보기</GhostButton>
			{error && <ErrorText>{error}</ErrorText>}
		</>
	);
}

function ListingLocation({ post }: { post: Post }) {
	const [area, setArea] = useState<Area | null>(null);
	const exact = !!post.ExactLocation;
	useEffect(() => {
		if (!exact && post.AreaId) fetchArea(post.AreaId).then(setArea).catch(() => {});
	}, [exact, post.AreaId]);
	if (!post.Latitude || !post.Longitude) return null;
	const point = { lat: post.Latitude, lng: post.Longitude };
	return (
		<Description aria-label="위치">
			<h2>위치</h2>
			<MapBox $h={260}>
				<PreviewMap pin={exact || !post.AreaId ? point : null} area={area} />
			</MapBox>
			<LocationSummary>
				{exact ? <MapPin size={16} aria-hidden /> : <MapIcon size={16} aria-hidden />}
				<span>{exact ? post.AreaName : `${post.AreaName ?? post.City} · 정확한 위치는 채팅으로 확인하세요`}</span>
			</LocationSummary>
		</Description>
	);
}

function Owner({ post, onChange }: { post: Post; onChange: (p: Post) => void }) {
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
		if (!(await confirm({ title: "글을 삭제할까요?", message: "삭제한 글은 되돌릴 수 없어요.", danger: true, confirmLabel: "삭제" }))) return;
		const { error } = await gql(`mutation($id: String!) { deletePost(PostId: $id) }`, { id: post.PostId });
		if (error) return setError(error);
		router.push(LISTING_PATH[type]);
		router.refresh();
	};

	return (
		<OwnerPanel aria-label="내 글 관리">
			<div>
				<strong>내 글 관리</strong>
				<Muted>{exp.expired ? "만료됐어요. 연장하면 다시 목록에 보여요." : `${exp.daysLeft}일 뒤 만료`}</Muted>
			</div>
			<div>
				<label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>상태
					<select value={post.Deal} onChange={e => run(`mutation($id: String!, $d: String!) { setListingDeal(PostId: $id, Deal: $d) { Deal } }`, { d: e.target.value })}>
						{DEALS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
					</select>
				</label>
				{!exp.expired && post.Deal !== "closed" && (
					<GhostButton type="button" onClick={() => run(`mutation($id: String!) { bumpListing(PostId: $id) { BumpedAt } }`)}>끌어올리기</GhostButton>
				)}
				{exp.extendable && (
					<GhostButton type="button" onClick={() => run(`mutation($id: String!) { extendListing(PostId: $id) { ExpiresAt Status } }`)}>30일 연장</GhostButton>
				)}
				<LinkButton href={`${LISTING_PATH[type]}/${post.PostId}/edit`} $ghost>수정</LinkButton>
				<TextButton type="button" $danger onClick={remove}>삭제</TextButton>
			</div>
			{error && <ErrorText role="alert">{error}</ErrorText>}
		</OwnerPanel>
	);
}

// ListingDetail renders a housing or job post. Like the community page,
// the server passes the public version and it is re-read with the cookie.
export function ListingDetail({ type, postId, initial }: { type: ListingType; postId: string; initial: Post | null }) {
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
				<p>글을 찾을 수 없어요. 삭제됐거나 기간이 끝난 글일 수 있어요.</p>
				<LinkButton href={LISTING_PATH[type]}>목록으로</LinkButton>
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
	const closed = post.Deal === "closed" || post.Status === "expired";

	return (
		<div>
			<DetailLayout>
				{post.Images && post.Images.length > 0
					? <ImageGallery images={post.Images} name={post.Title} />
					: <ListingLocation post={post} />}
				<InfoPanel>
					<Meta>
						<Link href={`${LISTING_PATH[type]}?mode=${h?.Mode ?? j?.Mode}`}><Tag>{modeLabel(type, h?.Mode ?? j?.Mode)}</Tag></Link>
						<span>{post.Topic}</span>
						{post.Deal !== "open" && <Tag $tone={post.Deal === "closed" ? "done" : "warning"}>{dealLabel(post.Deal)}</Tag>}
						{post.Status === "expired" && <Tag $tone="warning">기간 만료</Tag>}
						{post.Status === "hidden" && <Tag $tone="warning">신고로 숨겨진 글 · 나에게만 보여요</Tag>}
					</Meta>
					<h1>{post.Title}</h1>
					<BigPrice>{h ? rentLabel(h) : j ? wageLabel(j) : ""}</BigPrice>
					{h ? <HousingFacts post={post} /> : j ? <JobFacts post={post} /> : null}
					<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
						<Avatar src={post.AuthorImage} name={post.AuthorNickname} size={36} />
						<div style={{ flex: 1 }}>
							{post.AuthorId ? <Link href={`/user/${post.AuthorId}`}><strong>{post.AuthorNickname}</strong></Link> : <strong>{post.AuthorNickname}</strong>}
							<Meta>
								<span>{formatRelative(Math.max(post.BumpedAt ?? 0, post.CreatedAt))}</span>
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
								disabledLabel={post.Status === "expired" ? "기간이 끝난 글" : "모집이 끝났어요"}
								label={type === "housing" ? "채팅으로 문의하기" : j?.Mode === "hiring" ? "채팅으로 지원하기" : "채팅하기"}
							/>
							<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
								<ToggleButton type="button" $on={post.Bookmarked} aria-pressed={!!post.Bookmarked} onClick={toggleBookmark}>
									<Bookmark size={16} fill={post.Bookmarked ? "currentColor" : "none"} aria-hidden /> {post.Bookmarked ? "저장됨" : "저장"}
								</ToggleButton>
								{post.HasContact && <ContactReveal postId={post.PostId} />}
							</div>
						</div>
					)}
					{error && <ErrorText role="alert">{error}</ErrorText>}

					<SafetyBanner>
						<ShieldAlert size={18} aria-hidden />
						<span>
							{type === "housing"
								? "집을 직접 보고 계약서를 쓰기 전에는 보증금·월세를 보내지 마세요. 외부 메신저로 옮기자는 요청도 주의하세요."
								: "일을 시작하기 전에 돈을 요구하거나, 신분증·계좌 사진을 먼저 달라고 하면 사기예요."}
							{" "}<Link href="/safety">안전 가이드</Link>
						</span>
					</SafetyBanner>
				</InfoPanel>
			</DetailLayout>

			<Description aria-label="소개">
				<h2>소개</h2>
				<p><LinkedText text={post.Body ?? ""} /></p>
			</Description>
			{post.Images && post.Images.length > 0 && <ListingLocation post={post} />}
		</div>
	);
}
