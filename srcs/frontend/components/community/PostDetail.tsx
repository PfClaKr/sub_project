'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bookmark, CheckCircle2, Eye, Heart, MessageSquare } from "lucide-react";
import { boardLabel } from "@/libs/community";
import { gql, POST_DETAIL_FIELDS } from "@/libs/graphql";
import { formatDateTime, formatRelative, imageUrl } from "@/libs/format";
import { useSession } from "@/libs/session";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";
import { ActionBar, Article, AuthorLine, Body, Meta, Photos, Tag, TextButton, ToggleButton } from "@/styles/styledCommunity";
import { EmptyState, ErrorText, LinkButton, Muted, Skeleton } from "@/styles/styledUi";
import { Comments, LinkedText } from "./Comments";
import { ReportButton } from "./ReportButton";
import type { Post } from "@/libs/types";

const QUERY = `query Post($id: String!) { post(PostId: $id) { ${POST_DETAIL_FIELDS} } }`;

// PostDetail renders a post with its actions and thread. The server page
// passes the public version for a fast first paint; it is re-read with
// the session cookie for the viewer's own state (liked, bookmarked, mine).
export function PostDetail({ postId, initial }: { postId: string; initial: Post | null }) {
	const { session } = useSession();
	const confirm = useConfirm();
	const router = useRouter();
	const pathname = usePathname();
	const [post, setPost] = useState<Post | null>(initial);
	const [missing, setMissing] = useState(false);
	const [error, setError] = useState("");
	const viewed = useRef(false);

	const reload = useCallback(async () => {
		const { data, error } = await gql<{ post: Post | null }>(QUERY, { id: postId });
		if (error) setError(error);
		else if (!data?.post) setMissing(true);
		else setPost(data.post);
	}, [postId]);

	useEffect(() => {
		reload();
	}, [reload, session?.UserId]);

	// Count one view per page open (refs survive StrictMode's re-run).
	useEffect(() => {
		if (viewed.current) return;
		viewed.current = true;
		gql(`mutation($id: String!) { viewPost(PostId: $id) }`, { id: postId });
	}, [postId]);

	const requireLogin = () => {
		if (session) return true;
		router.push(`/login?next=${encodeURIComponent(pathname)}`);
		return false;
	};

	const toggleLike = async () => {
		if (!post || !requireLogin()) return;
		const { data, error } = await gql<{ likePost: Post }>(
			`mutation($id: String!, $on: Boolean!) { likePost(PostId: $id, On: $on) { LikeCount Liked } }`,
			{ id: post.PostId, on: !post.Liked },
		);
		if (error) setError(error);
		else if (data) setPost({ ...post, ...data.likePost });
	};

	const toggleBookmark = async () => {
		if (!post || !requireLogin()) return;
		const on = !post.Bookmarked;
		const { error } = await gql(`mutation($id: String!, $on: Boolean!) { bookmarkPost(PostId: $id, On: $on) }`, { id: post.PostId, on });
		if (error) setError(error);
		else setPost({ ...post, Bookmarked: on });
	};

	const remove = async () => {
		if (!post) return;
		if (!(await confirm({ title: "글을 삭제할까요?", message: "삭제한 글은 되돌릴 수 없어요.", danger: true, confirmLabel: "삭제" }))) return;
		const { error } = await gql(`mutation($id: String!) { deletePost(PostId: $id) }`, { id: post.PostId });
		if (error) {
			setError(error);
			return;
		}
		router.push(`/community?board=${post.Type}`);
		router.refresh();
	};

	if (missing) {
		return (
			<EmptyState>
				<p>글을 찾을 수 없어요. 삭제됐거나 비공개로 바뀐 글일 수 있어요.</p>
				<LinkButton href="/community">커뮤니티로</LinkButton>
			</EmptyState>
		);
	}
	if (!post) return <Skeleton $h="360px" />;

	const edited = post.UpdatedAt && post.UpdatedAt - post.CreatedAt > 60_000;

	return (
		<Article>
			<Meta>
				<Link href={`/community?board=${post.Type}`}><Tag>{boardLabel(post.Type)}</Tag></Link>
				<Link href={`/community?board=${post.Type}&topic=${encodeURIComponent(post.Topic)}`}>{post.Topic}</Link>
				{post.Type === "qna" && (post.Solved
					? <Tag $tone="done"><CheckCircle2 size={12} aria-hidden /> 해결</Tag>
					: <Tag $tone="warning">답변 대기</Tag>)}
				{post.Status === "hidden" && <Tag $tone="warning">신고로 숨겨진 글 · 나에게만 보여요</Tag>}
			</Meta>
			<h1>{post.Title}</h1>
			<AuthorLine>
				<Avatar src={post.AuthorImage} name={post.AuthorNickname} size={36} />
				<div style={{ flex: 1, minWidth: 0 }}>
					{post.AuthorId
						? <Link href={`/user/${post.AuthorId}`}><strong>{post.AuthorNickname}</strong></Link>
						: <strong>{post.AuthorNickname}</strong>}
					<Meta>
						<span title={formatDateTime(post.CreatedAt)}>{formatRelative(post.CreatedAt)}{edited ? " · 수정됨" : ""}</span>
						{post.City && <span>{post.City}</span>}
						<span><Eye size={13} aria-hidden /> {post.ViewCount ?? 0}</span>
					</Meta>
				</div>
				{post.IsMine ? (
					<div>
						<LinkButton href={`/community/${post.PostId}/edit`} $ghost style={{ padding: "6px 12px" }}>수정</LinkButton>
						<TextButton type="button" $danger onClick={remove}>삭제</TextButton>
					</div>
				) : (
					<ReportButton target={{ type: "post", id: post.PostId }} />
				)}
			</AuthorLine>

			<Body><LinkedText text={post.Body ?? ""} /></Body>
			{post.Images && post.Images.length > 0 && (
				<Photos>
					{post.Images.map(src => {
						const url = imageUrl(src);
						return url ? <a key={src} href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="첨부 사진" loading="lazy" /></a> : null;
					})}
				</Photos>
			)}

			<ActionBar>
				<ToggleButton type="button" $on={post.Liked} aria-pressed={!!post.Liked} onClick={toggleLike}>
					<Heart size={16} fill={post.Liked ? "currentColor" : "none"} aria-hidden /> 공감 {post.LikeCount ?? 0}
				</ToggleButton>
				<ToggleButton type="button" $on={post.Bookmarked} aria-pressed={!!post.Bookmarked} onClick={toggleBookmark}>
					<Bookmark size={16} fill={post.Bookmarked ? "currentColor" : "none"} aria-hidden /> {post.Bookmarked ? "저장됨" : "저장"}
				</ToggleButton>
				<Muted style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4 }}>
					<MessageSquare size={14} aria-hidden /> {post.CommentCount ?? 0}
				</Muted>
			</ActionBar>
			{error && <ErrorText role="alert">{error}</ErrorText>}

			<Comments post={post} onPostChange={reload} />
		</Article>
	);
}
