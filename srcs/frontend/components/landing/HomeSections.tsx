'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import {
	BedDouble, Briefcase, Bus, Check, CreditCard, FileCheck2, HeartPulse, Home, MessageCircleQuestion,
	MessagesSquare, ShieldCheck, ShoppingBag, Smartphone, UserCheck, type LucideIcon,
} from "lucide-react";
import { gql, LISTING_CARD_FIELDS, POST_LIST_FIELDS } from "@/libs/graphql";
import { useRegion } from "@/libs/region";
import { useSession } from "@/libs/session";
import { boardLabel, postHref } from "@/libs/community";
import { LISTING_PATH, modeLabel, rentLabel, wageLabel } from "@/libs/listing";
import { imageUrl } from "@/libs/format";
import { RegionChip } from "@/components/community/RegionChip";
import { TimeAgo } from "@/components/ui/TimeAgo";
import { Reveal } from "./Reveal";
import { Paw } from "./Paw";
import {
	Checklist, ChecklistItem, CtaBand, CtaButton, FeedBadge, FeedList, FeedRow, PurposeCard, PurposeGrid,
	SectionHead, TrustGrid,
} from "@/styles/styledLanding";
import { Muted, Skeleton } from "@/styles/styledUi";
import type { ListingType } from "@/libs/constants";
import type { Post, PostPage } from "@/libs/types";

// One colour pair per section (tinted background, text/icon ink), each
// ink keeping >= 4.5:1 contrast on its tint.
const TONES = {
	market: { tint: "#e1eeff", ink: "#0048b4" },
	community: { tint: "#ffe8f0", ink: "#b0306a" },
	housing: { tint: "#e6f6ff", ink: "#0a5c8a" },
	job: { tint: "#fff1e0", ink: "#8a4b00" },
};

export type HomeCounts = { selling: number | null; rooms: number | null; jobs: number | null; openQuestions: number | null };

type Purpose = {
	key: keyof typeof TONES;
	Icon: LucideIcon;
	title: string;
	body: string;
	href: string;
	count: (c: HomeCounts) => string | null;
	action: { label: string; href: string };
};

const PURPOSES: Purpose[] = [
	{
		key: "market", Icon: ShoppingBag, title: "물건 사고팔기", body: "귀국 정리, 이사 짐까지. 가까운 이웃과 직거래해요.", href: "/search",
		count: c => (c.selling == null ? null : `판매중 ${c.selling}개`), action: { label: "판매하기", href: "/sell" },
	},
	{
		key: "housing", Icon: BedDouble, title: "집 구하기", body: "쉐어, 스튜디오, 방학 서블렛. 보기 전에는 돈을 보내지 마세요.", href: "/housing",
		count: c => (c.rooms == null ? null : `방 ${c.rooms}개`), action: { label: "방 올리기", href: "/housing/write" },
	},
	{
		key: "job", Icon: Briefcase, title: "일 구하기", body: "식당, 과외, 통역. 시급과 계약 조건을 확인하고 지원해요.", href: "/jobs",
		count: c => (c.jobs == null ? null : `공고 ${c.jobs}개`), action: { label: "구인 올리기", href: "/jobs/write" },
	},
	{
		key: "community", Icon: MessageCircleQuestion, title: "생활 질문하기", body: "체류증, CAF, 은행. 먼저 겪어본 이웃이 답해줘요.", href: "/community?board=qna",
		count: c => (c.openQuestions == null ? null : `답을 기다리는 질문 ${c.openQuestions}개`), action: { label: "질문하기", href: "/community/write?board=qna" },
	},
];

export function PurposeCards({ counts }: { counts: HomeCounts }) {
	return (
		<PurposeGrid aria-label="무엇이 필요하세요?">
			{PURPOSES.map((p, i) => {
				const tone = TONES[p.key];
				const count = p.count(counts);
				return (
					<Reveal key={p.key} delay={i * 70}>
						<PurposeCard $tint={tone.tint} $ink={tone.ink}>
							<span className="icon" aria-hidden="true"><p.Icon size={22} /></span>
							<h3><Link href={p.href}>{p.title}</Link></h3>
							<p>{p.body}</p>
							{count && <span className="count">{count}</span>}
							<Link className="action" href={p.action.href}>{p.action.label}</Link>
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
const STEPS: { id: string; Icon: LucideIcon; title: string; body: string; href: string }[] = [
	{ id: "visa", Icon: FileCheck2, title: "체류증·비자", body: "비자 종류에 따라 도착 후 온라인 인증이나 체류증 신청(ANEF)이 필요해요.", href: topicHref("체류증·비자") },
	{ id: "bank", Icon: CreditCard, title: "은행 계좌", body: "월세, 월급, CAF에 계좌 증명서(RIB)가 필요해요.", href: topicHref("은행·통신") },
	{ id: "phone", Icon: Smartphone, title: "휴대폰 개통", body: "선불 유심으로 시작해 요금제로 바꾸는 경우가 많아요.", href: topicHref("은행·통신") },
	{ id: "caf", Icon: Home, title: "집과 CAF", body: "집을 구했다면 주거보조금(APL)을 받을 수 있는지 확인하세요.", href: topicHref("행정·CAF·세금") },
	{ id: "health", Icon: HeartPulse, title: "건강보험", body: "건강보험(Ameli)에 가입하고 주치의(médecin traitant)를 정해두세요.", href: topicHref("의료") },
	// No transport topic: search every board.
	{ id: "transport", Icon: Bus, title: "교통", body: "나비고 정기권, 26세 미만 학생이라면 Imagine R 할인을 알아보세요.", href: `/community?${new URLSearchParams({ q: "나비고" })}` },
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
	const [done, setDone] = useState<string[]>([]);
	useEffect(() => setDone(readDone()), []);

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
		<Checklist aria-labelledby="arrival">
			<header>
				<div>
					<h2 id="arrival">프랑스에 막 왔다면 ✈︎</h2>
					<p>처음 몇 주 동안 챙길 것들이에요. 막히면 먼저 겪어본 이웃에게 물어보세요.</p>
				</div>
				<div className="progress" aria-live="polite">
					{done.length} / {STEPS.length} 완료
					<div className="bar" aria-hidden="true"><span style={{ width: `${ratio * 100}%` }} /></div>
				</div>
			</header>
			<ul>
				{STEPS.map(s => {
					const on = done.includes(s.id);
					return (
						<ChecklistItem key={s.id} $done={on}>
							<button type="button" onClick={() => toggle(s.id)} aria-pressed={on} aria-label={`${s.title} ${on ? "완료 취소" : "완료로 표시"}`}>
								{on ? <Check size={15} strokeWidth={3} aria-hidden /> : <s.Icon size={14} color="#5d6382" aria-hidden />}
							</button>
							<div>
								<strong>{s.title}</strong>
								<p>{s.body}</p>
								<Link href={s.href}>관련 질문 보기 →</Link>
							</div>
						</ChecklistItem>
					);
				})}
			</ul>
		</Checklist>
	);
}

const FEED_QUERY = `query HomeFeed($city: String) {
	posts(Type: "community", City: $city, Size: 6) { Items { ${POST_LIST_FIELDS} } }
	housing: listings(Type: "housing", City: $city, Size: 3) { Items { ${LISTING_CARD_FIELDS} } }
	jobs: listings(Type: "job", City: $city, Size: 3) { Items { ${LISTING_CARD_FIELDS} } }
}`;

type FeedData = { posts: PostPage; housing: PostPage; jobs: PostPage };

function feedTone(post: Post) {
	if (post.Type === "housing") return { ...TONES.housing, label: "집", Icon: BedDouble };
	if (post.Type === "job") return { ...TONES.job, label: "알바", Icon: Briefcase };
	return { ...TONES.community, label: boardLabel(post.Type), Icon: post.Type === "qna" ? MessageCircleQuestion : MessagesSquare };
}

function NeighborRow({ post }: { post: Post }) {
	const tone = feedTone(post);
	const listing = post.Type === "housing" || post.Type === "job";
	const href = listing ? `${LISTING_PATH[post.Type as ListingType]}/${post.PostId}` : postHref(post);
	const thumb = imageUrl(post.Images?.[0]);
	const price = post.Housing ? rentLabel(post.Housing) : post.Job ? wageLabel(post.Job) : "";
	return (
		<FeedRow href={href}>
			{thumb ? <img className="thumb" src={thumb} alt="" loading="lazy" /> : <span className="thumb" style={{ background: tone.tint, color: tone.ink }}><tone.Icon size={22} aria-hidden /></span>}
			<span className="body">
				<span className="title">{post.Title}</span>
				<span className="meta">
					<FeedBadge $tint={tone.tint} $ink={tone.ink}>
						{listing ? `${tone.label} · ${modeLabel(post.Type as ListingType, post.Housing?.Mode ?? post.Job?.Mode)}` : tone.label}
					</FeedBadge>
					{price && <span className="price">{price}</span>}
					{!listing && post.Type === "qna" && <span>{post.Solved ? "해결" : `답변 ${post.CommentCount ?? 0}`}</span>}
					{!listing && post.Type !== "qna" && <span>댓글 {post.CommentCount ?? 0}</span>}
					<span>{post.AreaName || post.City}</span>
					<TimeAgo ts={Math.max(post.BumpedAt ?? 0, post.CreatedAt)} />
				</span>
			</span>
		</FeedRow>
	);
}

// The newest questions, posts, rooms and jobs in the chosen region, mixed
// by time.
export function NeighborFeed() {
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
					<h2 id="neighbors">이웃들의 최근 소식</h2>
					<p>질문, 이야기, 방, 알바를 새로 올라온 순서로 모았어요.</p>
				</div>
				<RegionChip />
			</SectionHead>
			{!items ? (
				<Skeleton $h="260px" />
			) : items.length === 0 ? (
				<Muted as="p">이 지역에는 아직 새 소식이 없어요. <Link href="/community/write">첫 글을 남겨보세요.</Link></Muted>
			) : (
				<FeedList>
					{items.map(p => <li key={p.PostId}><NeighborRow post={p} /></li>)}
				</FeedList>
			)}
		</section>
	);
}

const TRUST = [
	{ Icon: UserCheck, title: "이메일 인증 회원", body: "인증한 회원만 글을 쓰고 채팅할 수 있어요. 가입 7일이 지나야 집·알바 글을 올릴 수 있어요." },
	{ Icon: ShieldCheck, title: "신고하면 바로 숨김", body: "신고가 3건 쌓인 글은 운영진 확인 전까지 숨겨지고, 채팅에서는 상대를 차단할 수 있어요." },
	{ Icon: MessageCircleQuestion, title: "사기 수법 미리 알림", body: "선입금 요구, 외부 메신저 유도, 최저임금 미만 공고는 글을 올릴 때부터 경고해요." },
];

// For visitors who are not logged in: why it is safe, then sign up.
export function TrustAndJoin() {
	const { session, loading } = useSession();
	if (loading || session) return null;
	return (
		<>
			<section aria-labelledby="trust">
				<SectionHead>
					<div>
						<h2 id="trust">안심하고 쓰도록</h2>
						<p>해외에서는 피해를 되돌리기 어려워서, 처음부터 막는 데 신경 썼어요. <Link href="/safety">안전 가이드</Link></p>
					</div>
				</SectionHead>
				<TrustGrid>
					{TRUST.map(t => (
						<li key={t.title}>
							<t.Icon size={24} aria-hidden />
							<h3>{t.title}</h3>
							<p>{t.body}</p>
						</li>
					))}
				</TrustGrid>
			</section>
			<Reveal>
				<CtaBand>
					<h2>프랑스 한인 이웃들과 연결되냥 <Paw /></h2>
					<p>가입은 1분이면 충분해요. 물건, 집, 일, 질문 모두 무료예요.</p>
					<CtaButton href="/account/sign-up">무료로 가입하기</CtaButton>
				</CtaBand>
			</Reveal>
		</>
	);
}
