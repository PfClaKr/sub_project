'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
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
	const t = useTranslations("community.side");
	const L = useLabels();
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
		<SideColumn aria-label={t("label")}>
			<SideCard>
				<h2>{t("topics")}</h2>
				<SideList>
					{QNA_TOPICS.map(topic => {
						const active = params.board === "qna" && params.topic === topic;
						return (
							<li key={topic}>
								<Link href={boardHref(params, { board: "qna", topic })} aria-current={active ? "page" : undefined}>
									{L.enum("topic", topic)} <ChevronRight size={14} aria-hidden />
								</Link>
							</li>
						);
					})}
				</SideList>
			</SideCard>

			{open && open.length > 0 && (
				<SideCard>
					<h2><HelpCircle size={16} aria-hidden /> {t("waiting")}</h2>
					<SideList>
						{open.map(p => (
							<li key={p.PostId}>
								<Link href={`/community/${p.PostId}`}>
									<span>{p.Title}</span>
									<small>{p.CommentCount ? t("answers", { count: p.CommentCount }) : t("firstAnswer")}</small>
								</Link>
							</li>
						))}
					</SideList>
					<Link className="more" href={boardHref({}, { board: "qna", solved: "open" })}>{t("all")}</Link>
				</SideCard>
			)}

			<SideCard $soft>
				<h2><ShieldCheck size={16} aria-hidden /> {t("safetyTitle")}</h2>
				<p>{t("safetyBody")}</p>
				<Link className="more" href="/safety">{t("safetyLink")}</Link>
			</SideCard>
		</SideColumn>
	);
}
