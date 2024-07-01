import { Metadata } from "next";
import { ProductDetail } from "../../../../components/ProductDetail";
import { UserInformation } from "../../../../components/UserInformation";
import { ProductDescription } from "../../../../components/ProductDescription";

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
	return (
		<div>
			<div>
				<p>Product Details</p>
				<p>Home &gt; Pages &gt; Product Details</p>
			</div>
			<div>
				<ProductDetail
					productImage={productResult.data.product.ProductImage}
					productName={productResult.data.product.ProductName}
					productPrice={productResult.data.product.ProductPrice}
					preferedLocation={productResult.data.product.PreferedLocation}
					productCreatedAt={productResult.data.product.ProductCreatedAt}
				/>
			</div>
			<div>
				<UserInformation
					profileImage={userResult.data.user.ProfileImage}
					userNickname={userResult.data.user.UserNickname}
					publishedQuantity={userResult.data.user.PublishedQuantity}
				/>
			</div>
			<div>
				<ProductDescription
					productDescription={productResult.data.product.ProductDescription}
					preferedLocation={productResult.data.product.PreferedLocation}
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
