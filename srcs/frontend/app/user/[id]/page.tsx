import { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { getLabels } from "@/libs/labels.server";
import type { Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import ProductGrid from "@/components/product/ProductGrid";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader, Row, Section, SectionTitle } from "@/styles/styledLayout";
import { EmptyState, ErrorText } from "@/styles/styledUi";
import { gql, PRODUCT_CARD_FIELDS } from "@/libs/graphql";
import { formatDate } from "@/libs/format";
import type { Product, User } from "@/libs/types";

type Props = { params: { id: string } };

async function getProfile(userId: string) {
	return gql<{ user: User | null; userProducts: Product[] }>(
		`query Profile($userId: String!) {
			user(UserId: $userId) { UserId UserNickname ProfileImage Residence PublishedQuantity CreatedAt }
			userProducts(UserId: $userId) { ${PRODUCT_CARD_FIELDS} }
		}`,
		{ userId },
	);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { data } = await getProfile(params.id);
	return { title: data?.user?.UserNickname ?? (await getTranslations("profile"))("seller") };
}

export default async function UserPage({ params }: Props) {
	const { data, error } = await getProfile(params.id);
	if (error) return <ErrorText role="alert">{error}</ErrorText>;
	const user = data?.user;
	if (!user) notFound();
	const products = data?.userProducts ?? [];
	const t = await getTranslations("profile");
	const L = await getLabels();
	const locale = (await getLocale()) as Locale;

	return (
		<div>
			<PageHeader>
				<Row style={{ gap: 16 }}>
					<Avatar src={user.ProfileImage} name={user.UserNickname} size={64} />
					<div>
						<h1>{user.UserNickname}</h1>
						<p>{[L.enum("region", user.Residence), user.CreatedAt ? t("joined", { date: formatDate(user.CreatedAt, locale) }) : ""].filter(Boolean).join(" · ")}</p>
					</div>
				</Row>
			</PageHeader>
			<Section>
				<SectionTitle>{t("items", { count: products.length })}</SectionTitle>
				{products.length === 0
					? <EmptyState><p>{t("noItems")}</p></EmptyState>
					: <ProductGrid products={products} showSeller={false} />}
			</Section>
		</div>
	);
}
