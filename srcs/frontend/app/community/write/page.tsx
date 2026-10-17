import { Metadata } from "next";
import { NewPost } from "@/components/community/PostForm";
import { PageHeader } from "@/styles/styledLayout";

export const metadata: Metadata = { title: "글쓰기" };

type Props = { searchParams: { board?: string } };

export default function Page({ searchParams }: Props) {
	const board = searchParams.board === "free" ? "free" : "qna";
	return (
		<div>
			<PageHeader>
				<h1>{board === "qna" ? "질문하기" : "글쓰기"}</h1>
			</PageHeader>
			<NewPost board={board} />
		</div>
	);
}
