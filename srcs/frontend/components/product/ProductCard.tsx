'use client';

import {
	Thumb,
	ThumbContainer,
	Title,
	Price,
	Subtitle,
	InfoContainer,
	Card,
	StatusBadge,
 } from "@/styles/styledProductCard"

export default function ProductCard(props: any) {
	return (
		<Card>
			<ThumbContainer>
				{props.productImage?.[0] && <Thumb src={props.productImage[0]} />}
			</ThumbContainer>
			<InfoContainer>
				<Title>{props.productName}</Title>
				{props.productStatus && props.productStatus !== "판매중" && (
					<StatusBadge>{props.productStatus}</StatusBadge>
				)}
				<Price>&euro; {props.productPrice}</Price>
				<Subtitle>
					<div>{props.userId}</div>
					<div>{props.preferedLocation}</div>
				</Subtitle>
			</InfoContainer>
		</Card>
	);
}
