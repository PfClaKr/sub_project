import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { NewPost } from "@/components/community/PostForm";
import { PageHeader } from "@/styles/styledLayout";
import { WriteLayout } from "@/components/form/WriteLayout";

export const generateMetadata = pageMetadata("pages.writePost");

type Props = { searchParams: { board?: string } };

export default async function Page({ searchParams }: Props) {
	const board = searchParams.board === "free" ? "free" : "qna";
	return (
		<div>
			<PageHeader>
				<h1>{(await getTranslations("pages"))(board === "qna" ? "askQuestion.title" : "writePost.title")}</h1>
			</PageHeader>
			<WriteLayout kind={board}><NewPost board={board} /></WriteLayout>
		</div>
	);
}
