'use client';

import { useCallback, useEffect, useState, FormEvent } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { gql } from "@/libs/graphql";
import { nestComments, splitLinks, type CommentNode } from "@/libs/community";
import { useSession } from "@/libs/session";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Avatar } from "@/components/ui/Avatar";
import { CommentForm, CommentItem, CommentSection, Tag, TextButton } from "@/styles/styledCommunity";
import { ErrorText, LinkButton, Muted, Skeleton } from "@/styles/styledUi";
import { ReportButton } from "./ReportButton";
import type { Post, PostComment } from "@/libs/types";
import { TimeAgo } from "@/components/ui/TimeAgo";

const FIELDS = `CommentId ParentId Body DisplayName AuthorId AuthorImage Anonymous IsMine IsPostAuthor Deleted Hidden Accepted CreatedAt`;

export function LinkedText({ text }: { text: string }) {
	return (
		<>
			{splitLinks(text).map((part, i) =>
				part.href
					? <a key={i} href={part.href} target="_blank" rel="noopener noreferrer nofollow ugc">{part.text}</a>
					: <span key={i}>{part.text}</span>,
			)}
		</>
	);
}

type Props = {
	post: Post;
	// Called after anything that changes the post (count, accepted answer).
	onPostChange: () => void;
};

// Comments shows the thread, the reply forms and the answer picking for
// Q&A. The accepted answer is pinned above the thread.
export function Comments({ post, onPostChange }: Props) {
	const { session } = useSession();
	const confirm = useConfirm();
	const [comments, setComments] = useState<PostComment[] | null>(null);
	const [error, setError] = useState("");
	const [replyTo, setReplyTo] = useState<string | null>(null);

	const load = useCallback(async () => {
		const { data, error } = await gql<{ comments: PostComment[] }>(
			`query Comments($p: String!) { comments(PostId: $p) { ${FIELDS} } }`,
			{ p: post.PostId },
		);
		if (error) setError(error);
		setComments(data?.comments ?? []);
	}, [post.PostId]);

	useEffect(() => {
		load();
	}, [load]);

	// Opening a notification link (#c-<id>) scrolls to that comment once the
	// thread is rendered.
	useEffect(() => {
		if (!comments || !window.location.hash.startsWith("#c-")) return;
		document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "center" });
	}, [comments]);

	const refresh = async () => {
		await load();
		onPostChange();
	};

	const accept = async (c: PostComment) => {
		const ok = await confirm({
			title: "이 답변을 채택할까요?",
			message: "채택은 한 번만 할 수 있고, 채택한 답변은 위에 고정돼요.",
			confirmLabel: "채택하기",
		});
		if (!ok) return;
		const { error } = await gql(`mutation($p: String!, $c: String!) { acceptAnswer(PostId: $p, CommentId: $c) { PostId } }`, { p: post.PostId, c: c.CommentId });
		if (error) setError(error);
		await refresh();
	};

	const remove = async (c: PostComment) => {
		if (!(await confirm({ title: "댓글을 삭제할까요?", danger: true, confirmLabel: "삭제" }))) return;
		const { error } = await gql(`mutation($p: String!, $c: String!) { deleteComment(PostId: $p, CommentId: $c) }`, { p: post.PostId, c: c.CommentId });
		if (error) setError(error);
		await refresh();
	};

	const canAccept = (c: PostComment) =>
		post.Type === "qna" && post.IsMine && !post.AcceptedCommentId && !c.ParentId && !c.IsMine && !c.Deleted;

	const renderComment = (c: PostComment, reply: boolean, pinned = false) => (
		<CommentItem key={(pinned ? "pin-" : "") + c.CommentId} id={pinned ? undefined : `c-${c.CommentId}`} $reply={reply} $accepted={pinned}>
			{c.Deleted ? (
				<Muted as="p">{c.Hidden ? "신고로 가려진 댓글이에요." : "삭제된 댓글이에요."}</Muted>
			) : (
				<>
					<header>
						{pinned && <Tag $tone="done"><CheckCircle2 size={12} aria-hidden /> 채택된 답변</Tag>}
						<Avatar src={c.AuthorImage} name={c.DisplayName} size={24} />
						<strong>{c.DisplayName}</strong>
						{c.IsPostAuthor && !c.Anonymous && <Tag>글쓴이</Tag>}
						<Muted><TimeAgo ts={c.CreatedAt} /></Muted>
					</header>
					<p><LinkedText text={c.Body} /></p>
					{!pinned && (
						<footer>
							{session && !reply && <TextButton type="button" onClick={() => setReplyTo(replyTo === c.CommentId ? null : c.CommentId)}>답글</TextButton>}
							{canAccept(c) && <TextButton type="button" onClick={() => accept(c)}>채택하기</TextButton>}
							{c.IsMine && !c.Accepted && <TextButton type="button" $danger onClick={() => remove(c)}>삭제</TextButton>}
							{!c.IsMine && <ReportButton target={{ type: "comment", id: `${post.PostId}#${c.CommentId}` }} />}
						</footer>
					)}
				</>
			)}
		</CommentItem>
	);

	const nested: CommentNode[] = comments ? nestComments(comments) : [];
	const accepted = comments?.find(c => c.Accepted && !c.Deleted);
	const visibleCount = comments?.filter(c => !c.Deleted).length ?? 0;

	return (
		<CommentSection aria-labelledby="comments-title">
			<h2 id="comments-title">{post.Type === "qna" ? "답변" : "댓글"} {visibleCount}</h2>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<NewComment post={post} onPosted={refresh} />
			{comments === null && <Skeleton $h="120px" />}
			{accepted && renderComment(accepted, false, true)}
			{nested.map(node => (
				<div key={node.CommentId}>
					{renderComment(node, false)}
					{node.replies.map(r => renderComment(r, true))}
					{replyTo === node.CommentId && (
						<div style={{ marginLeft: 28 }}>
							<NewComment post={post} parentId={node.CommentId} onPosted={async () => { setReplyTo(null); await refresh(); }} autoFocus />
						</div>
					)}
				</div>
			))}
		</CommentSection>
	);
}

function NewComment({ post, parentId, onPosted, autoFocus }: {
	post: Post;
	parentId?: string;
	onPosted: () => Promise<void> | void;
	autoFocus?: boolean;
}) {
	const { session } = useSession();
	const pathname = usePathname();
	const [body, setBody] = useState("");
	const [anonymous, setAnonymous] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	if (!session) {
		if (parentId) return null;
		return (
			<Muted as="p" style={{ margin: "12px 0" }}>
				<LinkButton href={`/login?next=${encodeURIComponent(pathname)}`} $ghost>로그인하고 {post.Type === "qna" ? "답변" : "댓글"} 남기기</LinkButton>
			</Muted>
		);
	}

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (!body.trim()) return;
		setBusy(true);
		setError("");
		const { error } = await gql(
			`mutation($p: String!, $b: String!, $parent: String, $a: Boolean) { createComment(PostId: $p, Body: $b, ParentId: $parent, Anonymous: $a) { CommentId } }`,
			{ p: post.PostId, b: body, parent: parentId ?? null, a: anonymous },
		);
		setBusy(false);
		if (error) {
			setError(error);
			return;
		}
		setBody("");
		await onPosted();
	};

	return (
		<CommentForm onSubmit={submit}>
			<textarea
				value={body}
				onChange={e => setBody(e.target.value)}
				maxLength={1000}
				autoFocus={autoFocus}
				placeholder={parentId ? "답글을 남겨주세요" : post.Type === "qna" ? "알고 있는 걸 알려주세요. 경험담도 큰 도움이 돼요." : "댓글을 남겨주세요"}
				aria-label={parentId ? "답글" : "댓글"}
			/>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<div>
				{post.IsMine ? (
					<Muted>{post.Anonymous ? "글쓴이 댓글은 '익명(글쓴이)'로 표시돼요." : ""}</Muted>
				) : (
					<label>
						<input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /> 익명으로 쓰기
					</label>
				)}
				<button type="submit" disabled={busy || !body.trim()}>{busy ? "등록 중..." : "등록"}</button>
			</div>
		</CommentForm>
	);
}
