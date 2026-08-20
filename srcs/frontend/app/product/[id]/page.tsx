import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product/detail/ProductDetail";
import { UserCard } from "@/components/UserCard";
import { ProductDescription } from "@/components/product/detail/ProductDescription";
import { GRAPHQL_URL } from "@/libs/config";

export const metadata: Metadata = {
	title: "Product",
};

async function getProductInfo(productId: string) {
	try {
		const response = await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				query: `query Product($productId: String!) {
					product(ProductId: $productId) {
						ProductCategory
						ProductDescription
						UserId
						ProductName
						ProductImage
						ProductPrice
						PreferedLocation
						ProductCreatedAt
					}
				}`,
				variables: { productId },
			}),
			cache: 'no-store',
		});
		if (!response.ok) return null;
		const json = await response.json();
		return json.data?.product ?? null;
	} catch {
		return null;
	}
}

async function getUserInfo(userId: string) {
	try {
		const response = await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				query: `query User($userId: String!) {
					user(UserId: $userId) {
						ProfileImage
						UserNickname
						PublishedQuantity
					}
				}`,
				variables: { userId },
			}),
			cache: 'no-store',
		});
		if (!response.ok) return null;
		const json = await response.json();
		return json.data?.user ?? null;
	} catch {
		return null;
	}
}

export default async function ProductDetailPage({params: {id}}: {params: {id: string}; }) {
	const productData = await getProductInfo(id);
	if (!productData) notFound();

	const userdata = productData.UserId ? await getUserInfo(productData.UserId) : null;
	return (
		<div>
			<div>
				<p>Product Details</p>
				<p>Home &gt; Pages &gt; Product Details</p>
			</div>
			<div>
				<ProductDetail
					productId={id}
					productImage={productData.ProductImage}
					productName={productData.ProductName}
					productPrice={productData.ProductPrice}
					productCategory={productData.ProductCategory}
					preferedLocation={productData.PreferedLocation}
					productCreatedAt={productData.ProductCreatedAt}
				/>
			</div>
			{userdata && (
				<div>
					<UserCard
						profileImage={userdata.ProfileImage}
						userNickname={userdata.UserNickname}
						publishedQuantity={userdata.PublishedQuantity}
					/>
				</div>
			)}
			<div>
				<ProductDescription
					productDescription={productData.ProductDescription}
					preferedLocation={productData.PreferedLocation}
				/>
			</div>
		</div>
	);
}
