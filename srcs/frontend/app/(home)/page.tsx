import { Metadata } from "next";
import { SearchInput } from "../../components/SearchInput";
import DisplayTray from "@/components/product/DisplayTray";
import { GRAPHQL_URL } from "@/libs/config";

export const metadata: Metadata = {
	title: "Home",
};

async function getRecentProducts(limit: number) {
	try {
		const response = await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: `query RecentProducts($limit: Float) {
					recentProducts(Limit: $limit) {
						ProductId
						UserId
						ProductStatus
						ProductName
						ProductPrice
						ProductImage
						PreferedLocation
					}
				}`,
				variables: { limit },
			}),
			cache: 'no-store',
		});
		if (!response.ok) return [];
		const json = await response.json();
		return json.data?.recentProducts ?? [];
	} catch {
		// Backend unreachable: render the page with an empty feed.
		return [];
	}
}

export default async function HomePage() {
	const products = await getRecentProducts(8);
	return (
		<div>
			<div>
				<p>파리 한인 중고마켓</p>
				<h1>여기는 잇냥 사고팔 물건 있냥?</h1>
				<SearchInput />
			</div>
			<div>
				<p><strong>최근</strong>에 올라온거 뭐<strong>있냥</strong>?</p>
				{products.length > 0 ? (
					<DisplayTray products={products} />
				) : (
					<p>아직 올라온 물건이 없어요.</p>
				)}
			</div>
		</div>
	);
}
