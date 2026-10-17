'use client';

import Link from "next/link";
import { CheckCircle2, Heart, MessageSquare } from "lucide-react";
import { boardLabel, postHref } from "@/libs/community";
import { Meta, PostRowLink, PostRows, Tag } from "@/styles/styledCommunity";
import { Skeleton } from "@/styles/styledUi";
import type { Post } from "@/libs/types";
import { TimeAgo } from "@/components/ui/TimeAgo";

export function PostRow({ post, showBoard = true }: { post: Post; showBoard?: boolean }) {
	return (
		<PostRowLink as={Link} href={postHref(post)}>
			<Meta>
				{showBoard && <Tag>{boardLabel(post.Type)}</Tag>}
				<span>{post.Topic}</span>
				{post.Type === "qna" && (post.Solved
					? <Tag $tone="done"><CheckCircle2 size={12} aria-hidden /> 해결</Tag>
					: <Tag $tone="warning">답변 대기</Tag>)}
			</Meta>
			<h3>{post.Title}</h3>
			{post.BodyPreview && <p>{post.BodyPreview}</p>}
			<Meta style={{ marginTop: 6 }}>
				<span>{post.AuthorNickname}</span>
				<span><TimeAgo ts={post.CreatedAt} /></span>
				{post.City && <span>{post.City}</span>}
				<span aria-label={`댓글 ${post.CommentCount ?? 0}개`}><MessageSquare size={13} aria-hidden /> {post.CommentCount ?? 0}</span>
				<span aria-label={`공감 ${post.LikeCount ?? 0}개`}><Heart size={13} aria-hidden /> {post.LikeCount ?? 0}</span>
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
