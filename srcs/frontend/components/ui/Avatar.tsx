'use client';

import { AvatarCircle } from "@/styles/styledUi";
import { imageUrl } from "@/libs/format";

// Avatar shows the profile image, or the nickname's first letter.
export function Avatar({ src, name, size = 40 }: { src?: string | null; name?: string; size?: number }) {
	const url = imageUrl(src);
	return (
		<AvatarCircle $size={size} aria-hidden={!url}>
			{url ? <img src={url} alt={`${name ?? "사용자"} 프로필 사진`} /> : (name?.trim()[0] ?? "?")}
		</AvatarCircle>
	);
}
