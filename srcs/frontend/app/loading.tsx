import { ProductGridSkeleton } from "@/components/product/ProductGrid";
import { Skeleton } from "@/styles/styledUi";

export default function Loading() {
	return (
		<div>
			<Skeleton $h="32px" $w="40%" style={{ marginBottom: 24 }} />
			<ProductGridSkeleton />
		</div>
	);
}
