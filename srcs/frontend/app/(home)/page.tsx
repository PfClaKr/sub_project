import { Metadata } from "next";
import { SearchInput } from "../../components/searchInput";
import { ProductCard } from "../../components/productCard";
import { resourceLimits } from "worker_threads";

export const metadata: Metadata = {
	title: "Home",
};

// const TEST_PRODUCT_DATA = {
// 	img: "productcard_image.png",
// 	productTitle: "버리긴 아깝고 쓸데없는 물건",
// 	productPrice: "28.5",
// 	userNickname: "82sien",
// 	meetLocation: "75004 Paris",
// };

const URL = "http://golang:8080/graphql";

async function getProducts() {
	const response = await fetch(URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: `{
				item(ItemId: \"Item1\") {
					ItemId
					UserId
					Title
					Description
					Price
					Images
					Location
					CreatedAt
				}
			}`,
		}),
	});
	if (response.ok) {
		const json = await response.json();
		return json;
	}
	return [];
}

export default async function HomePage() {
	const productsJSON = await getProducts();
	// const products = JSON.stringify(productsJSON.data.item);
	return (
		<div>
			<div>
				<p>파리 한인 중고마켓</p>
				<h1>여기는 잇냥 사고팔 물건 있냥?</h1>
				<SearchInput />
				<p>lorem ipsum dolor sit amet</p>
			</div>
			<div>
				<p><strong>최근</strong>에 올라온거 뭐<strong>있냥</strong>?</p>
				<div>
					<ul>
						<ProductCard 
							userid={productsJSON.data.item.UserId}
							title={productsJSON.data.item.Title}
							description={productsJSON.data.item.Description}
							price={productsJSON.data.item.Price}
							images={productsJSON.data.item.Images}
							location={productsJSON.data.item.Location}
						/>
					</ul>
				</div>
			</div>
			<div>
				<p>필요한거 <strong>있냥</strong>?</p>
				<div>
					<ul>
						<li>New Arrival</li>
						<li>Best Seller</li>
						<li>Featured</li>
						<li>Special Offer</li>
					</ul>
				</div>
				<div>
					<ul>
						{/* <li>item 1</li>
						<li>item 2</li>
						<li>item 3</li>
						<li>item 4</li> */}
					</ul>
				</div>
			</div>
		</div>
	);
}
