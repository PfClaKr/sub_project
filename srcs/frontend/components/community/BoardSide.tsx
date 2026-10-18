'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, HelpCircle, ShieldCheck } from "lucide-react";
import { QNA_TOPICS } from "@/libs/constants";
import { boardHref, type BoardParams } from "@/libs/community";
import { gql } from "@/libs/graphql";
import { useRegion } from "@/libs/region";
import { SideCard, SideColumn, SideList } from "@/styles/styledCommunity";
import type { Post } from "@/libs/types";

type Open = Pick<Post, "PostId" | "Title" | "CommentCount">;

// BoardSide: the board's right column on wide screens. Q&A topics one
// click away, questions still waiting for an answer (in the chosen
// region), and the safety guide. Hidden on tablets and phones, where the
// topic chips cover it.
export function BoardSide({ params }: { params: BoardParams }) {
	const { city } = useRegion();
	const [open, setOpen] = useState<Open[] | null>(null);

	useEffect(() => {
		let alive = true;
		gql<{ posts: { Items: Open[] } }>(
			`query($city: String) { posts(Type: "qna", Solved: false, City: $city, Size: 5) { Items { PostId Title CommentCount } } }`,
			{ city: city || null },
		).then(({ data }) => alive && setOpen(data?.posts.Items ?? []));
		return () => {
			alive = false;
		};
	}, [city]);

	return (
		<SideColumn aria-label="커뮤니티 바로가기">
			<SideCard>
				<h2>생활 Q&A 주제</h2>
				<SideList>
					{QNA_TOPICS.map(t => {
						const active = params.board === "qna" && params.topic === t;
						return (
							<li key={t}>
								<Link href={boardHref(params, { board: "qna", topic: t })} aria-current={active ? "page" : undefined}>
									{t} <ChevronRight size={14} aria-hidden />
								</Link>
							</li>
						);
					})}
				</SideList>
			</SideCard>

			{open && open.length > 0 && (
				<SideCard>
					<h2><HelpCircle size={16} aria-hidden /> 답을 기다리는 질문</h2>
					<SideList>
						{open.map(p => (
							<li key={p.PostId}>
								<Link href={`/community/${p.PostId}`}>
									<span>{p.Title}</span>
									<small>{p.CommentCount ? `답변 ${p.CommentCount}` : "첫 답변을 남겨주세요"}</small>
								</Link>
							</li>
						))}
					</SideList>
					<Link className="more" href={boardHref({}, { board: "qna", solved: "open" })}>전체 보기</Link>
				</SideCard>
			)}

			<SideCard $soft>
				<h2><ShieldCheck size={16} aria-hidden /> 거래·계약 전에</h2>
				<p>보기 전에 돈을 보내거나, 외부 메신저로 옮기자는 요청은 사기일 수 있어요.</p>
				<Link className="more" href="/safety">안전 가이드 보기</Link>
			</SideCard>
		</SideColumn>
	);
}
