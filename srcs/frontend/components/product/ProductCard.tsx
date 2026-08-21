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
	const soldout = props.productStatus === "판매완료";
	return (
		<Card>
			<ThumbContainer $soldout={soldout}>
				{props.productImage?.[0] && <Thumb src={props.productImage[0]} alt={props.productName} />}
				{props.productStatus && props.productStatus !== "판매중" && (
					<StatusBadge>{props.productStatus}</StatusBadge>
				)}
			</ThumbContainer>
			<InfoContainer>
				<Title>{props.productName}</Title>
				<Price>€ {props.productPrice}</Price>
				<Subtitle>
					<div>{props.preferedLocation}</div>
				</Subtitle>
			</InfoContainer>
		</Card>
	);
}
