'use client';

import { DisplayTrayContainer, Container } from "@/styles/styledDisplayTray";
import ProductCard from "@/components/product/ProductCard";
import { StyledLink } from "@/styles/styledLink";
import styled from "styled-components"

export default function DisplayTray(props: any) {
	const products = props.products;
	return (
		<DisplayTrayContainer>
			{products.map((product: any) =>
				<Container>
					<StyledLink href={`/product/${product.ProductId}`}>
						<ProductCard
							productImage={product.ProductImage}
							productName={product.ProductName}
							productPrice={product.ProductPrice}
							userId={product.UserId}
							preferedLocation={product.PreferedLocation}
						/>
					</StyledLink>
				</Container>
			)}
		</DisplayTrayContainer>
	);
}
