export function ProductCard(props: any) {
	return (
		<div>
			<img src={props.images[0]} />
			<div>
				<p>{props.title}</p>
				<p>&euro; {props.price}</p>
				<p>{props.userid}</p>
				<p>{props.location}</p>
			</div>
		</div>
	);
}
