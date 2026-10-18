import { getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import { EditPost } from "@/components/community/EditPost";
import { PageHeader } from "@/styles/styledLayout";

export const generateMetadata = pageMetadata("pages.editPost");

export default async function Page({ params }: { params: { postId: string } }) {
	return (
		<div>
			<PageHeader>
				<h1>{(await getTranslations("pages.editPost"))("title")}</h1>
			</PageHeader>
			<EditPost postId={params.postId} />
		</div>
	);
}
