import { Metadata } from "next";
import { SearchInput } from "../../components/SearchInput";
import DisplayTray from "@/components/product/DisplayTray";

export const metadata: Metadata = {
	title: "Home",
};

// debug purpose
const URL = "http://127.0.0.1:8080/graphql";

async function getProducts() {
	const response = await fetch(URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			// need to change to newest products and separate files
			query: `{
				product(ProductId: \"Product1\") {
					ProductId
					UserId
					ProductName
					ProductDescription
					ProductPrice
					ProductImage
					PreferedLocation
					ProductCreatedAt
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
	// const productsJSON = await getProducts();
	// const product = productsJSON.data.product;
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
						{/* test */}
						{/* <DisplayTray
							product={product}
						/> */}
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
