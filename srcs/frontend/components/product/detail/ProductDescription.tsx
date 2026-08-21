import { DescriptionSection } from "@/styles/styledDetail";

export function ProductDescription(props: any) {
	return (
		<DescriptionSection>
			<h2>상품 설명</h2>
			<p>{props.productDescription}</p>
		</DescriptionSection>
	);
}
