'use client';

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Gallery, MainImage, Thumbs } from "@/styles/styledDetail";
import { NoImage } from "@/styles/styledProductCard";
import { imageUrl } from "@/libs/format";

export function ImageGallery({ images, name }: { images: string[]; name: string }) {
	const t = useTranslations("gallery");
	const urls = images.map(imageUrl).filter((u): u is string => !!u);
	const [current, setCurrent] = useState(0);

	if (urls.length === 0) {
		return <MainImage><NoImage>{t("none")}</NoImage></MainImage>;
	}
	return (
		<Gallery>
			<MainImage>
				<img src={urls[current]} alt={t("alt", { name, n: current + 1, total: urls.length })} />
			</MainImage>
			{urls.length > 1 && (
				<Thumbs>
					{urls.map((url, i) => (
						<button
							key={url}
							type="button"
							aria-label={t("show", { n: i + 1 })}
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
