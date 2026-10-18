'use client';

import { useTranslations } from "next-intl";
import { AvatarCircle } from "@/styles/styledUi";
import { imageUrl } from "@/libs/format";
import { ThumbImg } from "@/components/ui/ThumbImg";

// Avatar shows the profile image, or the nickname's first letter.
export function Avatar({ src, name, size = 40 }: { src?: string | null; name?: string; size?: number }) {
	const t = useTranslations("common");
	const url = imageUrl(src);
	return (
		<AvatarCircle $size={size} aria-hidden={!url}>
			{url ? <ThumbImg src={url} alt={t("profilePhoto", { name: name ?? t("member") })} /> : (name?.trim()[0] ?? "?")}
		</AvatarCircle>
	);
}
