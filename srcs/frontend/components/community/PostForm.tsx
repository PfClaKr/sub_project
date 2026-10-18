'use client';

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
import { BOARDS, REGIONS, type BoardType } from "@/libs/constants";
import { gql } from "@/libs/graphql";
import { uploadImages } from "@/libs/upload";
import { useRegion } from "@/libs/region";
import { useSession } from "@/libs/session";
import { Counter, FieldLabel, FormColumn, FormSection, Hint, SubmitButton, TwoColumns } from "@/styles/styledForm";
import { ErrorText } from "@/styles/styledUi";
import { SimilarBox } from "@/styles/styledCommunity";
import { ImageUploader, photoFromUrl, type Photo } from "@/components/form/ImageUploader";
import { RequireLogin } from "@/components/ui/RequireLogin";
import type { Post } from "@/libs/types";

const BODY_MAX = 5000;

// SimilarQuestions shows earlier questions while a title is typed, so an
// answer that already exists is found before asking again.
function SimilarQuestions({ title }: { title: string }) {
	const t = useTranslations("community.form");
	const [items, setItems] = useState<Post[]>([]);

	useEffect(() => {
		const text = title.trim();
		if (text.length < 4) {
			setItems([]);
			return;
		}
		const timer = window.setTimeout(async () => {
			const { data } = await gql<{ similarQuestions: Post[] }>(
				`query($t: String!) { similarQuestions(Title: $t) { PostId Title Solved CommentCount } }`,
				{ t: text },
			);
			setItems(data?.similarQuestions ?? []);
		}, 400);
		return () => window.clearTimeout(timer);
	}, [title]);

	if (items.length === 0) return null;
	return (
		<SimilarBox aria-live="polite">
			<strong>{t("similar")}</strong>
			<ul>
				{items.map(p => (
					<li key={p.PostId}>
						<Link href={`/community/${p.PostId}`} target="_blank">{p.Title}</Link>
						{" "}<Hint>{p.Solved ? t("similarSolved") : t("similarAnswers", { count: p.CommentCount ?? 0 })}</Hint>
					</li>
				))}
			</ul>
		</SimilarBox>
	);
}

// PostForm writes a free or Q&A post, or edits one when `post` is given
// (the board and anonymity are fixed after posting).
export function PostForm({ post, board: initialBoard }: { post?: Post; board?: BoardType }) {
	const t = useTranslations("community.form");
	const c = useTranslations("common");
	const L = useLabels();
	const router = useRouter();
	const { session } = useSession();
	const { city } = useRegion();
	const [board, setBoard] = useState<BoardType>((post?.Type as BoardType | undefined) ?? initialBoard ?? "qna");
	const [topic, setTopic] = useState(post?.Topic ?? "");
	const [title, setTitle] = useState(post?.Title ?? "");
	const [body, setBody] = useState(post?.Body ?? "");
	const [region, setRegion] = useState(post?.City ?? "");
	const [anonymous, setAnonymous] = useState(false);
	const [photos, setPhotos] = useState<Photo[]>(() => (post?.Images ?? []).map(photoFromUrl));
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	// Default region: the chip's choice, then the member's residence.
	useEffect(() => {
		if (region) return;
		const fallback = city || session?.Residence || "";
		if ((REGIONS as readonly string[]).includes(fallback)) setRegion(fallback);
	}, [city, session?.Residence, region]);

	const topics = BOARDS[board].topics;

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setError("");
		if (!topics.includes(topic)) {
			setError(t("chooseTopic"));
			return;
		}
		setSubmitting(true);
		try {
			const uploaded = await uploadImages(photos.flatMap(p => (p.file ? [p.file] : [])));
			let next = 0;
			const images = photos.map(p => (p.file ? uploaded[next++] : p.url));
			const input = { Type: board, Topic: topic, City: region || null, Title: title, Body: body, Images: images, Anonymous: anonymous };
			const result = post
				? await gql<{ updatePost: { PostId: string } }>(
					`mutation($id: String!, $in: PostInput!) { updatePost(PostId: $id, Input: $in) { PostId } }`,
					{ id: post.PostId, in: input },
				).then(r => ({ id: r.data?.updatePost?.PostId, error: r.error }))
				: await gql<{ createPost: { PostId: string } }>(
					`mutation($in: PostInput!) { createPost(Input: $in) { PostId } }`,
					{ in: input },
				).then(r => ({ id: r.data?.createPost?.PostId, error: r.error }));
			if (!result.id) {
				setError(result.error ?? c("saveError"));
				return;
			}
			router.push(`/community/${result.id}`);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : c("saveError"));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={submit} style={{ maxWidth: 720 }}>
			<FormSection aria-labelledby="sec-board">
				<header><h2 id="sec-board">{t("where")}</h2></header>
				<TwoColumns>
					<FieldLabel>{t("board")}
						<select value={board} disabled={!!post} onChange={e => { setBoard(e.target.value as BoardType); setTopic(""); }}>
							{(Object.keys(BOARDS) as BoardType[]).map(b => <option key={b} value={b}>{L.board(b)}</option>)}
						</select>
					</FieldLabel>
					<FieldLabel>{t("topic")}
						<select value={topic} required onChange={e => setTopic(e.target.value)}>
							<option value="" disabled>{c("choose")}</option>
							{topics.map(topic => <option key={topic} value={topic}>{L.enum("topic", topic)}</option>)}
						</select>
					</FieldLabel>
				</TwoColumns>
				<FieldLabel>{c("region")} <Hint>{c("regionHint")}</Hint>
					<select value={region} onChange={e => setRegion(e.target.value)}>
						{REGIONS.map(r => <option key={r} value={r}>{L.enum("region", r)}</option>)}
					</select>
				</FieldLabel>
			</FormSection>

			<FormSection aria-labelledby="sec-content">
				<header>
					<h2 id="sec-content">{board === "qna" ? t("question") : t("content")}</h2>
					{board === "qna" && <p>{t("questionTip")}</p>}
				</header>
				<FieldLabel>{c("title")}
					<input
						type="text"
						required
						minLength={2}
						maxLength={100}
						value={title}
						onChange={e => setTitle(e.target.value)}
						placeholder={board === "qna" ? t("titleQna") : t("titleFree")}
					/>
				</FieldLabel>
				{board === "qna" && !post && <SimilarQuestions title={title} />}
				<FieldLabel>
					<span className="sr-only">{c("body")}</span>
					<textarea required rows={10} maxLength={BODY_MAX} value={body} onChange={e => setBody(e.target.value)}
						placeholder={board === "qna" ? t("bodyQna") : t("bodyFree")} />
					<Counter>{body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}</Counter>
				</FieldLabel>
				<ImageUploader photos={photos} onChange={setPhotos} uploading={submitting} />
				{!post && (
					<label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14 }}>
						<input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} style={{ width: "auto", marginTop: 3 }} />
						<span>
							<span style={{ display: "block", fontWeight: 600 }}>{t("anonymous")}</span>
							<Hint>{t("anonymousHint")}</Hint>
						</span>
					</label>
				)}
			</FormSection>

			{error && <ErrorText role="alert">{error}</ErrorText>}
			<SubmitButton type="submit" disabled={submitting}>
				{submitting ? c("saving") : post ? t("update") : board === "qna" ? t("postQna") : t("postFree")}
			</SubmitButton>
		</FormColumn>
	);
}

// NewPost is the write page's body: login first, then the form.
export function NewPost({ board }: { board: BoardType }) {
	return <RequireLogin>{() => <PostForm board={board} />}</RequireLogin>;
}
