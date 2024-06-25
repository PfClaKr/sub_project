import { Metadata } from "next";
import { SearchInput } from "../../components/searchInput";

export const metadata: Metadata = {
	title: "Home",
};

export default function HomePage() {
	return (
		<div>
			<div>
				<p>파리 한인 중고마켓</p>
				<h1>여기는 잇냥 사고팔 물건 있냥?</h1>
				<SearchInput />
				<p>lorem ipsum dolor sit amet</p>
			</div>
			<div>
				<p><strong>최근</strong>에 올라온거 뭐<strong>있냥</strong>?</p>
				<div>
					<ul>
						<li>item 1</li>
						<li>item 2</li>
						<li>item 3</li>
						<li>item 4</li>
					</ul>
				</div>
			</div>
			<div>
				<p>필요한거 <strong>있냥</strong>?</p>
				<div>
					<ul>
						<li>New Arrival</li>
						<li>Best Seller</li>
						<li>Featured</li>
						<li>Special Offer</li>
					</ul>
				</div>
				<div>
					<ul>
						<li>item 1</li>
						<li>item 2</li>
						<li>item 3</li>
						<li>item 4</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
