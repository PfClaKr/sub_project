'use client';

import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { thumbUrl } from "@/libs/format";

// ThumbImg shows the small copy of an uploaded photo (libs/format.ts
// thumbUrl) and falls back to the photo itself when there is none
// (uploaded before thumbnails existed). The fallback also covers an error
// that fired before React hydrated.
export function ThumbImg({ src, ...props }: { src: string } & Omit<ImgHTMLAttributes<HTMLImageElement>, "src">) {
	const small = thumbUrl(src);
	const [failed, setFailed] = useState(false);
	const ref = useRef<HTMLImageElement | null>(null);
	useEffect(() => {
		const img = ref.current;
		if (img?.complete && img.naturalWidth === 0) setFailed(true);
	}, []);
	// eslint-disable-next-line jsx-a11y/alt-text -- alt comes from props
	return <img ref={ref} {...props} src={small && !failed ? small : src} onError={() => setFailed(true)} />;
}
