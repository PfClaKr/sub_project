'use client';

import {
	Thumb,
	ThumbContainer,
	Title,
	Price,
	Subtitle,
	InfoContainer,
	Card,
 } from "@/styles/styledProduct"

export default function ProductCard(props: any) {
	return (
		<Card>
			<ThumbContainer>
				<Thumb />
			</ThumbContainer>
			{/* <img src={props.productImage[0]} /> */}
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
