export function ProductCard(props: any) {
	return (
		<div>
			<img src={props.productImage[0]} />
			<div>
				<p>{props.productName}</p>
				<p>&euro; {props.productPrice}</p>
				<p>{props.userId}</p>
				<p>{props.preferedLocation}</p>
			</div>
		</div>
	);
}
