'use client';

import { useState } from "react";
import { Gallery, MainImage, Thumbs } from "@/styles/styledDetail";
import { NoImage } from "@/styles/styledProductCard";
import { imageUrl } from "@/libs/format";

export function ImageGallery({ images, name }: { images: string[]; name: string }) {
	const urls = images.map(imageUrl).filter((u): u is string => !!u);
	const [current, setCurrent] = useState(0);

	if (urls.length === 0) {
		return <MainImage><NoImage>사진 없음</NoImage></MainImage>;
	}
	return (
		<Gallery>
			<MainImage>
				<img src={urls[current]} alt={`${name} 사진 ${current + 1}/${urls.length}`} />
			</MainImage>
			{urls.length > 1 && (
				<Thumbs>
					{urls.map((url, i) => (
						<button
							key={url}
							type="button"
							aria-label={`사진 ${i + 1} 보기`}
							aria-current={i === current}
							onClick={() => setCurrent(i)}
						>
							<img src={url} alt="" />
						</button>
					))}
				</Thumbs>
			)}
		</Gallery>
	);
}
