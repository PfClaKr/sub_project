import { Metadata } from "next";
import { ProductDetail } from "@/components/product/detail/ProductDetail";
import { UserCard } from "@/components/UserCard";
import { ProductDescription } from "@/components/product/detail/ProductDescription";

export const metadata: Metadata = {
	title: "Product",
};

async function getProductInfo(searchKeyword: string) {
	return await fetch('http://golang:8080/graphql', {
		method: 'POST',
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			query: `{
				product(ProductId: \"${searchKeyword}\") {
					ProductCategory
					ProductDescription
					UserId
					ProductName
					ProductImage
					ProductPrice
					PreferedLocation
					ProductCreatedAt
				}
			}`
		})
	}).then(response => response.json());
}

async function getUserInfo(searchKeyword: string) {
	return await fetch('http://golang:8080/graphql', {
		method: 'POST',
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			query: `{
				user(UserId: \"${searchKeyword}\") {
					ProfileImage
					UserNickname
					PublishedQuantity
				}
			}`
		})
	}).then(response => response.json());
}

export default async function ProductDetailPage({params: {id}}: {params: {id: string}; }) {
	const productResult = await getProductInfo(id);
	const userResult = await getUserInfo(productResult.data.product.UserId);
	const productData = productResult.data.product;
	const userdata = userResult.data.user;
	return (
		<div>
			<div>
				<p>Product Details</p>
				<p>Home &gt; Pages &gt; Product Details</p>
			</div>
			<div>
				<ProductDetail
					productImage={productData.ProductImage}
					productName={productData.ProductName}
					productPrice={productData.ProductPrice}
					productCategory={productData.ProductCategory}
					preferedLocation={productData.PreferedLocation}
					productCreatedAt={productData.ProductCreatedAt}
				/>
			</div>
			<div>
				<UserCard
					profileImage={userdata.ProfileImage}
					userNickname={userdata.UserNickname}
					publishedQuantity={userdata.PublishedQuantity}
				/>
			</div>
			<div>
				<ProductDescription
					productDescription={productData.ProductDescription}
					preferedLocation={productData.PreferedLocation}
				/>
			</div>
			{/* <div>
				<p>이런건 <strong>어떠냥</strong> ?</p>
				<ul>
					<li>item 1</li>
					<li>item 2</li>
					<li>item 3</li>
					<li>item 4</li>
				</ul>
			</div> */}
		</div>
	);
}
