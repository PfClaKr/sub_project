'use client';

import { useEffect, useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
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

const BOARD_TABS: (BoardType | undefined)[] = [undefined, "qna", "free"];

// CommunityBoard lists free and Q&A posts. Filters live in the URL so a
// list can be shared and the back button works; the region comes from
// the shared region chip.
export function CommunityBoard() {
	const t = useTranslations("community");
	const c = useTranslations("common");
	const L = useLabels();
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
			if (error || !data) setError(error ?? t("loadError"));
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
				<h1>{t("title")}</h1>
				<LinkButton href={session ? writeHref : `/login?next=${encodeURIComponent(writeHref)}`}>
					<SquarePen size={16} aria-hidden style={{ marginRight: 6, verticalAlign: -3 }} />{t("write")}
				</LinkButton>
			</BoardHeader>

			<BoardLayout>
				<div>
					<ChipRow aria-label={t("boardsLabel")} style={{ marginBottom: 12 }}>
						{BOARD_TABS.map(b => (
							<Chip key={b ?? "all"} href={boardHref(params, { board: b })} $active={params.board === b} aria-current={params.board === b ? "page" : undefined}>
								{b ? L.board(b) : t("all")}
							</Chip>
						))}
					</ChipRow>
					{topics.length > 0 && (
						<ChipRow aria-label={t("topicsLabel")} style={{ marginBottom: 12 }}>
							<Chip href={boardHref(params, { topic: undefined })} $active={!params.topic}>{t("allTopics")}</Chip>
							{topics.map(topic => (
								<Chip key={topic} href={boardHref(params, { topic })} $active={params.topic === topic}>{L.enum("topic", topic)}</Chip>
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
								placeholder={params.board === "qna" ? t("searchQna") : t("searchAll")}
								aria-label={t("searchLabel")}
								maxLength={100}
							/>
							<GhostButton type="submit" aria-label={t("searchAll")}><Search size={16} /></GhostButton>
						</form>
						{params.board === "qna" && (
							<select
								aria-label={t("solvedLabel")}
								value={params.solved ?? ""}
								onChange={e => go({ solved: (e.target.value || undefined) as BoardParams["solved"] })}
							>
								<option value="">{t("allQuestions")}</option>
								<option value="open">{t("openQuestions")}</option>
								<option value="solved">{t("solvedQuestions")}</option>
							</select>
						)}
						<select aria-label={t("sortLabel")} value={params.sort ?? ""} onChange={e => go({ sort: (e.target.value || undefined) as BoardParams["sort"] })}>
							<option value="">{params.q ? t("relevance") : t("newest")}</option>
							{params.q && <option value="newest">{t("newest")}</option>}
							<option value="popular">{t("popular")}</option>
						</select>
					</Toolbar>

					{error && <ErrorText role="alert">{error}</ErrorText>}
					{!error && !data && <PostListSkeleton />}
					{data?.Corrected && <Muted as="p">{t("corrected")}</Muted>}
					{data && data.Items.length === 0 && (
						<EmptyState>
							<p>{params.q ? t("noMatch", { q: params.q }) : t("empty")}</p>
							<LinkButton href={writeHref}>{params.board === "qna" ? t("ask") : t("write")}</LinkButton>
						</EmptyState>
					)}
					{data && data.Items.length > 0 && <PostList posts={data.Items} showBoard={!params.board} />}

					{data && data.TotalPages > 1 && (
						<Pagination aria-label={t("pages")}>
							{data.Page > 1 && <LinkButton href={boardHref(params, { page: data.Page - 1 })} $ghost>{c("prev")}</LinkButton>}
							<span>{data.Page} / {data.TotalPages}</span>
							{data.Page < data.TotalPages && <LinkButton href={boardHref(params, { page: data.Page + 1 })} $ghost>{c("next")}</LinkButton>}
						</Pagination>
					)}
				</div>
				<BoardSide params={params} />
			</BoardLayout>
		</div>
	);
}
