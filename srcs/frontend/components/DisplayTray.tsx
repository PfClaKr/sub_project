'use client';

import Link from "next/link"
import { DisplayTrayContainer } from "@/styles/styledDisplayTray";
import ProductCard from "@/components/ProductCard";

export default function DisplayTray(props: any) {
	const products = props.products;
	return (
		<DisplayTrayContainer>
			{products.map((product: any) =>
				<Link href={`/${product.ProductId}`}>
					<ProductCard
					productImage={product.ProductImage}
					productName={product.ProductName}
					productPrice={product.ProductPrice}
					userId={product.UserId}
					preferedLocation={product.PreferedLocation}
					/>
				</Link>
			)}
		</DisplayTrayContainer>
	);
}
