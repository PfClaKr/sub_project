'use client';

import { useState } from "react";
import { GalleryMain, GalleryThumbs, GalleryThumb } from "@/styles/styledDetail";

export const Gallery = ({ images, alt }: { images?: string[]; alt?: string }) => {
	const [index, setIndex] = useState(0);
	const list = images ?? [];

	return (
		<div>
			<GalleryMain>
				{list[index] && <img src={list[index]} alt={alt} />}
			</GalleryMain>
			{list.length > 1 && (
				<GalleryThumbs>
					{list.map((src, i) => (
						<GalleryThumb key={src} $active={i === index} onClick={() => setIndex(i)}>
							<img src={src} alt="" />
						</GalleryThumb>
					))}
				</GalleryThumbs>
			)}
		</div>
	);
};
