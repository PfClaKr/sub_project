import { SellerCard, SellerName, SellerMeta } from "@/styles/styledDetail";

export function UserCard(props: any) {
	return (
		<SellerCard>
			{props.profileImage && <img src={props.profileImage} alt={props.userNickname} />}
			<div>
				<SellerName>{props.userNickname}</SellerName>
				<SellerMeta>판매 상품 {props.publishedQuantity ?? 0}개</SellerMeta>
			</div>
		</SellerCard>
	);
}
