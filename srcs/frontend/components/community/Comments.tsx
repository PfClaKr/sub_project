'use client';

import { useCallback, useEffect, useState, FormEvent } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
	const t = useTranslations("community.comments");
	const common = useTranslations("common");
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
			title: t("acceptTitle"),
			message: t("acceptBody"),
			confirmLabel: t("accept"),
		});
		if (!ok) return;
		const { error } = await gql(`mutation($p: String!, $c: String!) { acceptAnswer(PostId: $p, CommentId: $c) { PostId } }`, { p: post.PostId, c: c.CommentId });
		if (error) setError(error);
		await refresh();
	};

	const remove = async (c: PostComment) => {
		if (!(await confirm({ title: t("deleteTitle"), danger: true, confirmLabel: common("delete") }))) return;
		const { error } = await gql(`mutation($p: String!, $c: String!) { deleteComment(PostId: $p, CommentId: $c) }`, { p: post.PostId, c: c.CommentId });
		if (error) setError(error);
		await refresh();
	};

	const canAccept = (c: PostComment) =>
		post.Type === "qna" && post.IsMine && !post.AcceptedCommentId && !c.ParentId && !c.IsMine && !c.Deleted;

	const renderComment = (c: PostComment, reply: boolean, pinned = false) => (
		<CommentItem key={(pinned ? "pin-" : "") + c.CommentId} id={pinned ? undefined : `c-${c.CommentId}`} $reply={reply} $accepted={pinned}>
			{c.Deleted ? (
				<Muted as="p">{c.Hidden ? t("hidden") : t("deleted")}</Muted>
			) : (
				<>
					<header>
						{pinned && <Tag $tone="done"><CheckCircle2 size={12} aria-hidden /> {t("accepted")}</Tag>}
						<Avatar src={c.AuthorImage} name={c.DisplayName} size={24} />
						<strong>{c.DisplayName}</strong>
						{c.IsPostAuthor && !c.Anonymous && <Tag>{t("author")}</Tag>}
						<Muted><TimeAgo ts={c.CreatedAt} /></Muted>
					</header>
					<p><LinkedText text={c.Body} /></p>
					{!pinned && (
						<footer>
							{session && !reply && <TextButton type="button" onClick={() => setReplyTo(replyTo === c.CommentId ? null : c.CommentId)}>{t("reply")}</TextButton>}
							{canAccept(c) && <TextButton type="button" onClick={() => accept(c)}>{t("accept")}</TextButton>}
							{c.IsMine && !c.Accepted && <TextButton type="button" $danger onClick={() => remove(c)}>{common("delete")}</TextButton>}
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
			<h2 id="comments-title">{t(post.Type === "qna" ? "answers" : "comments", { count: visibleCount })}</h2>
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
	const t = useTranslations("community.comments");
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
				<LinkButton href={`/login?next=${encodeURIComponent(pathname)}`} $ghost>{t(post.Type === "qna" ? "loginAnswer" : "loginComment")}</LinkButton>
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
				placeholder={parentId ? t("replyPlaceholder") : post.Type === "qna" ? t("answerPlaceholder") : t("commentPlaceholder")}
				aria-label={parentId ? t("replyLabel") : t("commentLabel")}
			/>
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<div>
				{post.IsMine ? (
					<Muted>{post.Anonymous ? t("authorAnon") : ""}</Muted>
				) : (
					<label>
						<input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /> {t("anonymous")}
					</label>
				)}
				<button type="submit" disabled={busy || !body.trim()}>{busy ? t("posting") : t("post")}</button>
			</div>
		</CommentForm>
	);
}
