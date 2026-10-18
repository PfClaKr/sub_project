import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Unsubscribe } from "@/components/notification/Unsubscribe";
import { PageHeader } from "@/styles/styledLayout";

export async function generateMetadata(): Promise<Metadata> {
	return { title: (await getTranslations("pages.unsubscribe"))("title"), robots: { index: false } };
}

export default async function Page() {
	return (
		<div>
			<PageHeader>
				<h1>{(await getTranslations("pages.unsubscribe"))("title")}</h1>
			</PageHeader>
			<Suspense>
				<Unsubscribe />
			</Suspense>
		</div>
	);
}
