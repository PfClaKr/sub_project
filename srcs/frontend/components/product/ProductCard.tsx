'use client';

import {
	Thumb,
	ThumbContainer,
	Title,
	Price,
	Subtitle,
	InfoContainer,
	Card,
 } from "@/styles/styledProductCard"

export default function ProductCard(props: any) {
	return (
		<Card>
			<ThumbContainer>
				<Thumb src={props.productImage[0]} />
			</ThumbContainer>
			<InfoContainer>
				<Title>{props.productName}</Title>
				<Price>&euro; {props.productPrice}</Price>
				<Subtitle>
					<div>{props.userId}</div>
					<div>{props.preferedLocation}</div>
				</Subtitle>
			</InfoContainer>
		</Card>
	);
}
