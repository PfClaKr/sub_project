'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
	BedDouble, Briefcase, Bus, Check, CreditCard, FileCheck2, HeartPulse, Home, MessageCircleQuestion,
	MessagesSquare, ShieldCheck, ShoppingBag, Smartphone, UserCheck, X, type LucideIcon,
} from "lucide-react";
import { gql, LISTING_CARD_FIELDS, POST_LIST_FIELDS } from "@/libs/graphql";
import { useRegion } from "@/libs/region";
import { useSession } from "@/libs/session";
import { postHref } from "@/libs/community";
import { LISTING_PATH } from "@/libs/listing";
import { useLabels, type Labels } from "@/libs/labels";
import { imageUrl } from "@/libs/format";
import { RegionChip } from "@/components/community/RegionChip";
import { ARRIVAL_PREPAINT, setArrivalHidden } from "@/libs/arrival";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { Reveal } from "./Reveal";
import { Paw } from "./Paw";
import {
	Checklist, ChecklistItem, CtaBand, CtaButton, DismissedNote, FeedBadge, FeedList, FeedRow, PurposeCard, PurposeGrid,
	SectionHead, TrustGrid,
} from "@/styles/styledLanding";
import { Muted, Skeleton } from "@/styles/styledUi";
import type { ListingType } from "@/libs/constants";
import type { Post, PostPage } from "@/libs/types";
import { ThumbImg } from "@/components/ui/ThumbImg";

// One colour pair per section (tinted background, text/icon ink), each
// ink keeping >= 4.5:1 contrast on its tint.
const TONES = {
	market: { tint: "#e1eeff", ink: "#0048b4" },
	community: { tint: "#ffe8f0", ink: "#b0306a" },
	housing: { tint: "#e6f6ff", ink: "#0a5c8a" },
	job: { tint: "#fff1e0", ink: "#8a4b00" },
};

export type HomeCounts = { selling: number | null; rooms: number | null; jobs: number | null; openQuestions: number | null };

// Texts: home.purposes.<key>.{title,body,count,action}.
type Purpose = {
	key: keyof typeof TONES;
	Icon: LucideIcon;
	href: string;
	count: (c: HomeCounts) => number | null;
	actionHref: string;
};

const PURPOSES: Purpose[] = [
	{ key: "market", Icon: ShoppingBag, href: "/search", count: c => c.selling, actionHref: "/sell" },
	{ key: "housing", Icon: BedDouble, href: "/housing", count: c => c.rooms, actionHref: "/housing/write" },
	{ key: "job", Icon: Briefcase, href: "/jobs", count: c => c.jobs, actionHref: "/jobs/write" },
	{ key: "community", Icon: MessageCircleQuestion, href: "/community?board=qna", count: c => c.openQuestions, actionHref: "/community/write?board=qna" },
];

export function PurposeCards({ counts }: { counts: HomeCounts }) {
	const t = useTranslations("home.purposes");
	return (
		<PurposeGrid aria-label={t("label")}>
			{PURPOSES.map((p, i) => {
				const tone = TONES[p.key];
				const count = p.count(counts);
				return (
					<Reveal key={p.key} delay={i * 70}>
						<PurposeCard $tint={tone.tint} $ink={tone.ink}>
							<span className="icon" aria-hidden="true"><p.Icon size={22} /></span>
							<h3><Link href={p.href}>{t(`${p.key}.title`)}</Link></h3>
							<p>{t(`${p.key}.body`)}</p>
							{count != null && <span className="count">{t(`${p.key}.count`, { count })}</span>}
							<Link className="action" href={p.actionHref}>{t(`${p.key}.action`)}</Link>
						</PurposeCard>
					</Reveal>
				);
			})}
		</PurposeGrid>
	);
}

// The first weeks in France, each step tied to the matching Q&A topic
// (the whole topic, not a keyword search, which a young board often
// leaves empty). Ticks are kept in this browser only (a guide, not
// account data).
// Texts: home.checklist.steps.<id>. topic: the Q&A topic it links to;
// transport has none, so it searches every board (checklist.transportQuery).
const STEPS: { id: "visa" | "bank" | "phone" | "caf" | "health" | "transport"; Icon: LucideIcon; topic?: string }[] = [
	{ id: "visa", Icon: FileCheck2, topic: "체류증·비자" },
	{ id: "bank", Icon: CreditCard, topic: "은행·통신" },
	{ id: "phone", Icon: Smartphone, topic: "은행·통신" },
	{ id: "caf", Icon: Home, topic: "행정·CAF·세금" },
	{ id: "health", Icon: HeartPulse, topic: "의료" },
	{ id: "transport", Icon: Bus },
];

function topicHref(topic: string): string {
	return `/community?${new URLSearchParams({ board: "qna", topic })}`;
}
const STORAGE_KEY = "itnyang.arrival";

function readDone(): string[] {
	try {
		const v = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
		return Array.isArray(v) ? v : [];
	} catch {
		return [];
	}
}

export function NewcomerChecklist() {
	const t = useTranslations("home.checklist");
	const [done, setDone] = useState<string[]>([]);
	// Dismissed during this visit: a one-line note with an undo replaces it.
	const [dismissed, setDismissed] = useState(false);
	useEffect(() => setDone(readDone()), []);

	const dismiss = (hidden: boolean) => {
		setArrivalHidden(hidden);
		setDismissed(hidden);
	};

	const toggle = (id: string) => {
		const next = done.includes(id) ? done.filter(d => d !== id) : [...done, id];
		setDone(next);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			// storage unavailable: the ticks last for this visit
		}
	};
	const ratio = done.length / STEPS.length;

	return (
		<>
			<script dangerouslySetInnerHTML={{ __html: ARRIVAL_PREPAINT }} />
			{dismissed && (
				<DismissedNote role="status">
					{t("dismissed")}
					<button type="button" onClick={() => dismiss(false)}>{t("undo")}</button>
				</DismissedNote>
			)}
		<Checklist aria-labelledby="arrival" data-arrival="">
			<header>
				<div>
					<h2 id="arrival">{t("title")}</h2>
					<p>{t("lead")}</p>
				</div>
				<div className="progress" aria-live="polite">
					{done.length === STEPS.length ? t("allDone") : t("progress", { done: done.length, total: STEPS.length })}
					<div className="bar" aria-hidden="true"><span style={{ width: `${ratio * 100}%` }} /></div>
				</div>
				<button type="button" className="dismiss" onClick={() => dismiss(true)}>
					<X size={14} aria-hidden /> {t("dismiss")}
				</button>
			</header>
			<ul>
				{STEPS.map(s => {
					const on = done.includes(s.id);
					const title = t(`steps.${s.id}.title`);
					const href = s.topic ? topicHref(s.topic) : `/community?${new URLSearchParams({ q: t("transportQuery") })}`;
					return (
						<ChecklistItem key={s.id} $done={on}>
							<button type="button" onClick={() => toggle(s.id)} aria-pressed={on} aria-label={t(on ? "markUndone" : "markDone", { step: title })}>
								{on ? <Check size={15} strokeWidth={3} aria-hidden /> : <s.Icon size={14} color="#5d6382" aria-hidden />}
							</button>
							<div>
								<strong>{title}</strong>
								<p>{t(`steps.${s.id}.body`)}</p>
								<Link href={href}>{t("related")}</Link>
							</div>
						</ChecklistItem>
					);
				})}
			</ul>
		</Checklist>
		</>
	);
}

const FEED_QUERY = `query HomeFeed($city: String) {
	posts(Type: "community", City: $city, Size: 6) { Items { ${POST_LIST_FIELDS} } }
	housing: listings(Type: "housing", City: $city, Size: 3) { Items { ${LISTING_CARD_FIELDS} } }
	jobs: listings(Type: "job", City: $city, Size: 3) { Items { ${LISTING_CARD_FIELDS} } }
}`;

type FeedData = { posts: PostPage; housing: PostPage; jobs: PostPage };

function feedTone(post: Post, t: ReturnType<typeof useTranslations<"home.feed">>, L: Labels) {
	if (post.Type === "housing") return { ...TONES.housing, label: t("housing"), Icon: BedDouble };
	if (post.Type === "job") return { ...TONES.job, label: t("job"), Icon: Briefcase };
	return { ...TONES.community, label: L.board(post.Type), Icon: post.Type === "qna" ? MessageCircleQuestion : MessagesSquare };
}

function NeighborRow({ post }: { post: Post }) {
	const t = useTranslations("home.feed");
	const L = useLabels();
	const tone = feedTone(post, t, L);
	const listing = post.Type === "housing" || post.Type === "job";
	const href = listing ? `${LISTING_PATH[post.Type as ListingType]}/${post.PostId}` : postHref(post);
	const thumb = imageUrl(post.Images?.[0]);
	const price = post.Housing ? L.rent(post.Housing) : post.Job ? L.wage(post.Job) : "";
	return (
		<FeedRow href={href}>
			{thumb ? <ThumbImg className="thumb" src={thumb} alt="" loading="lazy" /> : <span className="thumb" style={{ background: tone.tint, color: tone.ink }}><tone.Icon size={22} aria-hidden /></span>}
			<span className="body">
				<span className="title">{post.Title}</span>
				<span className="meta">
					<FeedBadge $tint={tone.tint} $ink={tone.ink}>
						{listing ? `${tone.label} · ${L.mode(post.Type as ListingType, post.Housing?.Mode ?? post.Job?.Mode)}` : tone.label}
					</FeedBadge>
					{price && <span className="price">{price}</span>}
					{!listing && post.Type === "qna" && <span>{post.Solved ? t("solved") : t("answers", { count: post.CommentCount ?? 0 })}</span>}
					{!listing && post.Type !== "qna" && <span>{t("comments", { count: post.CommentCount ?? 0 })}</span>}
					<span>{post.AreaName || L.enum("region", post.City)}</span>
					<TimeAgo ts={Math.max(post.BumpedAt ?? 0, post.CreatedAt)} />
				</span>
			</span>
		</FeedRow>
	);
}

// The newest questions, posts, rooms and jobs in the chosen region, mixed
// by time.
export function NeighborFeed() {
	const t = useTranslations("home.feed");
	const { city } = useRegion();
	const [items, setItems] = useState<Post[] | null>(null);

	useEffect(() => {
		let alive = true;
		setItems(null);
		gql<FeedData>(FEED_QUERY, { city: city || null }).then(({ data }) => {
			if (!alive) return;
			const all = [...(data?.posts.Items ?? []), ...(data?.housing.Items ?? []), ...(data?.jobs.Items ?? [])];
			all.sort((a, b) => Math.max(b.BumpedAt ?? 0, b.CreatedAt) - Math.max(a.BumpedAt ?? 0, a.CreatedAt));
			setItems(all.slice(0, 10));
		});
		return () => {
			alive = false;
		};
	}, [city]);

	return (
		<section aria-labelledby="neighbors">
			<SectionHead style={{ flexWrap: "wrap" }}>
				<div>
					<h2 id="neighbors">{t("title")}</h2>
					<p>{t("lead")}</p>
				</div>
				<RegionChip />
			</SectionHead>
			{!items ? (
				<Skeleton $h="260px" />
			) : items.length === 0 ? (
				<Muted as="p">{t("empty")} <Link href="/community/write">{t("emptyAction")}</Link></Muted>
			) : (
				<FeedList>
					{items.map(p => <li key={p.PostId}><NeighborRow post={p} /></li>)}
				</FeedList>
			)}
		</section>
	);
}

// Texts: home.trust.<key>.
const TRUST = [
	{ key: "verified", Icon: UserCheck },
	{ key: "reports", Icon: ShieldCheck },
	{ key: "scams", Icon: MessageCircleQuestion },
] as const;

// For visitors who are not logged in: why it is safe, then sign up.
export function TrustAndJoin() {
	const t = useTranslations("home");
	const { session, loading } = useSession();
	if (loading || session) return null;
	return (
		<>
			<section aria-labelledby="trust">
				<SectionHead>
					<div>
						<h2 id="trust">{t("trust.title")}</h2>
						<p>{t("trust.lead")} <Link href="/safety">{t("trust.guide")}</Link></p>
					</div>
				</SectionHead>
				<TrustGrid>
					{TRUST.map(item => (
						<li key={item.key}>
							<item.Icon size={24} aria-hidden />
							<h3>{t(`trust.${item.key}.title`)}</h3>
							<p>{t(`trust.${item.key}.body`)}</p>
						</li>
					))}
				</TrustGrid>
			</section>
			<Reveal>
				<CtaBand>
					<h2>{t("cta.title")} <Paw /></h2>
					<p>{t("cta.lead")}</p>
					<CtaButton href="/account/sign-up">{t("cta.button")}</CtaButton>
				</CtaBand>
			</Reveal>
		</>
	);
}
