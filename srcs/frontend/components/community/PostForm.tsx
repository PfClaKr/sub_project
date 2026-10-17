'use client';

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
	const [items, setItems] = useState<Post[]>([]);

	useEffect(() => {
		const t = title.trim();
		if (t.length < 4) {
			setItems([]);
			return;
		}
		const timer = window.setTimeout(async () => {
			const { data } = await gql<{ similarQuestions: Post[] }>(
				`query($t: String!) { similarQuestions(Title: $t) { PostId Title Solved CommentCount } }`,
				{ t },
			);
			setItems(data?.similarQuestions ?? []);
		}, 400);
		return () => window.clearTimeout(timer);
	}, [title]);

	if (items.length === 0) return null;
	return (
		<SimilarBox aria-live="polite">
			<strong>비슷한 질문이 이미 있어요</strong>
			<ul>
				{items.map(p => (
					<li key={p.PostId}>
						<Link href={`/community/${p.PostId}`} target="_blank">{p.Title}</Link>
						{" "}<Hint>{p.Solved ? "· 해결됨" : `· 답변 ${p.CommentCount ?? 0}`}</Hint>
					</li>
				))}
			</ul>
		</SimilarBox>
	);
}

// PostForm writes a free or Q&A post, or edits one when `post` is given
// (the board and anonymity are fixed after posting).
export function PostForm({ post, board: initialBoard }: { post?: Post; board?: BoardType }) {
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
			setError("주제를 골라주세요.");
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
				setError(result.error ?? "저장하지 못했어요. 다시 시도해주세요.");
				return;
			}
			router.push(`/community/${result.id}`);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "저장하지 못했어요.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={submit} style={{ maxWidth: 720 }}>
			<FormSection aria-labelledby="sec-board">
				<header><h2 id="sec-board">어디에 올릴까요?</h2></header>
				<TwoColumns>
					<FieldLabel>게시판
						<select value={board} disabled={!!post} onChange={e => { setBoard(e.target.value as BoardType); setTopic(""); }}>
							{(Object.keys(BOARDS) as BoardType[]).map(b => <option key={b} value={b}>{BOARDS[b].label}</option>)}
						</select>
					</FieldLabel>
					<FieldLabel>주제
						<select value={topic} required onChange={e => setTopic(e.target.value)}>
							<option value="" disabled>선택해주세요</option>
							{topics.map(t => <option key={t} value={t}>{t}</option>)}
						</select>
					</FieldLabel>
				</TwoColumns>
				<FieldLabel>지역 <Hint>지역 필터에 쓰여요</Hint>
					<select value={region} onChange={e => setRegion(e.target.value)}>
						{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
					</select>
				</FieldLabel>
			</FormSection>

			<FormSection aria-labelledby="sec-content">
				<header>
					<h2 id="sec-content">{board === "qna" ? "질문" : "내용"}</h2>
					{board === "qna" && <p>상황을 구체적으로 쓸수록 정확한 답을 받을 수 있어요. (체류 자격, 지역, 시기 등)</p>}
				</header>
				<FieldLabel>제목
					<input
						type="text"
						required
						minLength={2}
						maxLength={100}
						value={title}
						onChange={e => setTitle(e.target.value)}
						placeholder={board === "qna" ? "예: 학생 체류증 갱신, 온라인 예약은 언제 열리나요?" : "제목을 입력해주세요"}
					/>
				</FieldLabel>
				{board === "qna" && !post && <SimilarQuestions title={title} />}
				<FieldLabel>
					<span className="sr-only">본문</span>
					<textarea required rows={10} maxLength={BODY_MAX} value={body} onChange={e => setBody(e.target.value)}
						placeholder={board === "qna" ? "궁금한 점을 자세히 적어주세요." : "자유롭게 이야기해주세요."} />
					<Counter>{body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}</Counter>
				</FieldLabel>
				<ImageUploader photos={photos} onChange={setPhotos} uploading={submitting} />
				{!post && (
					<label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
						<input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} style={{ width: "auto" }} />
						익명으로 쓰기 <Hint>닉네임 대신 &lsquo;익명&rsquo;으로 보여요. 올린 뒤에는 바꿀 수 없어요.</Hint>
					</label>
				)}
			</FormSection>

			{error && <ErrorText role="alert">{error}</ErrorText>}
			<SubmitButton type="submit" disabled={submitting}>
				{submitting ? "저장 중..." : post ? "수정 완료" : board === "qna" ? "질문 올리기" : "글 올리기"}
			</SubmitButton>
		</FormColumn>
	);
}

// NewPost is the write page's body: login first, then the form.
export function NewPost({ board }: { board: BoardType }) {
	return <RequireLogin>{() => <PostForm board={board} />}</RequireLogin>;
}
