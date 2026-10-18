'use client';

import { useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SquarePen } from "lucide-react";
import { BOARDS, type BoardType } from "@/libs/constants";
import { boardHref, parseBoardParams, type BoardParams } from "@/libs/community";
import { gql, POST_LIST_FIELDS } from "@/libs/graphql";
import { useRegion } from "@/libs/region";
import { useSession } from "@/libs/session";
import { Chip, ChipRow, EmptyState, ErrorText, GhostButton, LinkButton, Muted, Pagination } from "@/styles/styledUi";
import { BoardHeader, BoardLayout, Toolbar } from "@/styles/styledCommunity";
import { BoardSide } from "./BoardSide";
import { PostList, PostListSkeleton } from "./PostList";
import { RegionChip } from "./RegionChip";
import type { PostPage } from "@/libs/types";

const QUERY = `query Board($type: String, $topic: String, $city: String, $q: String, $solved: Boolean, $sort: String, $page: Int) {
	posts(Type: $type, Topic: $topic, City: $city, Q: $q, Solved: $solved, Sort: $sort, Page: $page) {
		Items { ${POST_LIST_FIELDS} } Page TotalPages Total Corrected
	}
}`;

const BOARD_TABS: { key?: BoardType; label: string }[] = [
	{ label: "전체" },
	{ key: "qna", label: BOARDS.qna.label },
	{ key: "free", label: BOARDS.free.label },
];

// CommunityBoard lists free and Q&A posts. Filters live in the URL so a
// list can be shared and the back button works; the region comes from
// the shared region chip.
export function CommunityBoard() {
	const sp = useSearchParams();
	const router = useRouter();
	const { session } = useSession();
	const { city } = useRegion();
	const params: BoardParams = parseBoardParams(sp);
	const key = sp.toString();

	const [data, setData] = useState<PostPage | null>(null);
	const [error, setError] = useState("");
	const [query, setQuery] = useState(params.q ?? "");

	useEffect(() => {
		let alive = true;
		setData(null);
		setError("");
		const p = parseBoardParams(new URLSearchParams(key));
		gql<{ posts: PostPage }>(QUERY, {
			type: p.board ?? "community",
			topic: p.topic ?? null,
			city: city || null,
			q: p.q ?? null,
			solved: p.solved ? p.solved === "solved" : null,
			sort: p.sort ?? null,
			page: p.page ?? 1,
		}).then(({ data, error }) => {
			if (!alive) return;
			if (error || !data) setError(error ?? "글을 불러오지 못했어요.");
			else setData(data.posts);
		});
		return () => {
			alive = false;
		};
	}, [key, city]);

	useEffect(() => setQuery(parseBoardParams(new URLSearchParams(key)).q ?? ""), [key]);

	const go = (change: Partial<BoardParams>) => router.push(boardHref(params, change));
	const onSearch = (e: FormEvent) => {
		e.preventDefault();
		go({ q: query.trim() || undefined });
	};
	const writeHref = `/community/write${params.board ? `?board=${params.board}` : ""}`;
	const topics = params.board ? BOARDS[params.board].topics : [];

	return (
		<div>
			<BoardHeader>
				<h1>커뮤니티</h1>
				<LinkButton href={session ? writeHref : `/login?next=${encodeURIComponent(writeHref)}`}>
					<SquarePen size={16} aria-hidden style={{ marginRight: 6, verticalAlign: -3 }} />글쓰기
				</LinkButton>
			</BoardHeader>

			<BoardLayout>
				<div>
					<ChipRow aria-label="게시판" style={{ marginBottom: 12 }}>
						{BOARD_TABS.map(t => (
							<Chip key={t.label} href={boardHref(params, { board: t.key })} $active={params.board === t.key} aria-current={params.board === t.key ? "page" : undefined}>
								{t.label}
							</Chip>
						))}
					</ChipRow>
					{topics.length > 0 && (
						<ChipRow aria-label="주제" style={{ marginBottom: 12 }}>
							<Chip href={boardHref(params, { topic: undefined })} $active={!params.topic}>전체 주제</Chip>
							{topics.map(t => (
								<Chip key={t} href={boardHref(params, { topic: t })} $active={params.topic === t}>{t}</Chip>
							))}
						</ChipRow>
					)}

					<Toolbar>
						<RegionChip />
						<form role="search" onSubmit={onSearch}>
							<input
								type="search"
								value={query}
								onChange={e => setQuery(e.target.value)}
								placeholder={params.board === "qna" ? "궁금한 걸 검색해보세요 (예: 체류증 갱신)" : "글 검색"}
								aria-label="커뮤니티 검색"
								maxLength={100}
							/>
							<GhostButton type="submit" aria-label="검색"><Search size={16} /></GhostButton>
						</form>
						{params.board === "qna" && (
							<select
								aria-label="답변 상태"
								value={params.solved ?? ""}
								onChange={e => go({ solved: (e.target.value || undefined) as BoardParams["solved"] })}
							>
								<option value="">모든 질문</option>
								<option value="open">답변 대기</option>
								<option value="solved">해결됨</option>
							</select>
						)}
						<select aria-label="정렬" value={params.sort ?? ""} onChange={e => go({ sort: (e.target.value || undefined) as BoardParams["sort"] })}>
							<option value="">{params.q ? "관련순" : "최신순"}</option>
							{params.q && <option value="newest">최신순</option>}
							<option value="popular">인기순</option>
						</select>
					</Toolbar>

					{error && <ErrorText role="alert">{error}</ErrorText>}
					{!error && !data && <PostListSkeleton />}
					{data?.Corrected && <Muted as="p">정확히 맞는 글이 없어 비슷한 글을 보여드려요.</Muted>}
					{data && data.Items.length === 0 && (
						<EmptyState>
							<p>{params.q ? `"${params.q}"에 맞는 글이 없어요.` : "아직 글이 없어요. 첫 글을 남겨보세요."}</p>
							<LinkButton href={writeHref}>{params.board === "qna" ? "질문하기" : "글쓰기"}</LinkButton>
						</EmptyState>
					)}
					{data && data.Items.length > 0 && <PostList posts={data.Items} showBoard={!params.board} />}

					{data && data.TotalPages > 1 && (
						<Pagination aria-label="페이지">
							{data.Page > 1 && <LinkButton href={boardHref(params, { page: data.Page - 1 })} $ghost>← 이전</LinkButton>}
							<span>{data.Page} / {data.TotalPages}</span>
							{data.Page < data.TotalPages && <LinkButton href={boardHref(params, { page: data.Page + 1 })} $ghost>다음 →</LinkButton>}
						</Pagination>
					)}
				</div>
				<BoardSide params={params} />
			</BoardLayout>
		</div>
	);
}
