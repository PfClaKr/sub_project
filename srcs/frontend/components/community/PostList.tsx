'use client';

import Link from "next/link";
import { CheckCircle2, Heart, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";
import { postHref } from "@/libs/community";
import { useLabels } from "@/libs/labels";
import { Meta, PostRowLink, PostRows, Tag } from "@/styles/styledCommunity";
import { Skeleton } from "@/styles/styledUi";
import type { Post } from "@/libs/types";
import { TimeAgo } from "@/components/ui/TimeAgo";

export function PostRow({ post, showBoard = true }: { post: Post; showBoard?: boolean }) {
	const t = useTranslations("community");
	const c = useTranslations("common");
	const L = useLabels();
	return (
		<PostRowLink as={Link} href={postHref(post)}>
			<Meta>
				{showBoard && <Tag>{L.board(post.Type)}</Tag>}
				<span>{L.enum("topic", post.Topic)}</span>
				{post.Type === "qna" && (post.Solved
					? <Tag $tone="done"><CheckCircle2 size={12} aria-hidden /> {c("solved")}</Tag>
					: <Tag $tone="warning">{c("waiting")}</Tag>)}
			</Meta>
			<h3>{post.Title}</h3>
			{post.BodyPreview && <p>{post.BodyPreview}</p>}
			<Meta style={{ marginTop: 6 }}>
				<span>{L.name(post.AuthorNickname)}</span>
				<span><TimeAgo ts={post.CreatedAt} /></span>
				{post.City && <span>{L.enum("region", post.City)}</span>}
				<span aria-label={t("commentsCount", { count: post.CommentCount ?? 0 })}><MessageSquare size={13} aria-hidden /> {post.CommentCount ?? 0}</span>
				<span aria-label={t("likesCount", { count: post.LikeCount ?? 0 })}><Heart size={13} aria-hidden /> {post.LikeCount ?? 0}</span>
			</Meta>
		</PostRowLink>
	);
}

export function PostList({ posts, showBoard }: { posts: Post[]; showBoard?: boolean }) {
	return (
		<PostRows>
			{posts.map(p => <li key={p.PostId}><PostRow post={p} showBoard={showBoard} /></li>)}
		</PostRows>
	);
}

export function PostListSkeleton({ count = 5 }: { count?: number }) {
	return (
		<div>
			{Array.from({ length: count }, (_, i) => <Skeleton key={i} $h="78px" style={{ marginBottom: 8 }} />)}
		</div>
	);
}
