import { Metadata } from "next";
import { SearchInput } from "../../components/SearchInput";

export const metadata: Metadata = {
	title: "Search",
};

export default function SearchPage() {
	return (
		<div>
			<p>Shop Grid Default</p>
			<p>Home &gt; Pages &gt; Shop Grid Default</p>
			<SearchInput/>
			{/* <p>Ecommerce Accesories &amp; Fashion Item</p>
			<p>About 9,620 results &#40;0.62 seconds&#41;</p> */}
		</div>
	);
}
