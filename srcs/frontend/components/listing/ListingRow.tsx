'use client';

import Link from "next/link";
import { BedDouble, Briefcase, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { LISTING_PATH } from "@/libs/listing";
import { useLabels } from "@/libs/labels";
import { imageUrl } from "@/libs/format";
import { ListingCard, ListingCards } from "@/styles/styledListing";
import { Meta, Tag } from "@/styles/styledCommunity";
import type { ListingType } from "@/libs/constants";
import type { Post } from "@/libs/types";
import { TimeAgo } from "@/components/ui/TimeAgo";

export function ListingRow({ post }: { post: Post }) {
	const t = useTranslations("listing.row");
	const L = useLabels();
	const type = post.Type as ListingType;
	const thumb = imageUrl(post.Images?.[0]);
	const Icon = type === "housing" ? BedDouble : Briefcase;
	const h = post.Housing;
	const j = post.Job;
	return (
		<ListingCard as={Link} href={`${LISTING_PATH[type]}/${post.PostId}`} $closed={post.Deal === "closed"}>
			{thumb ? <img className="thumb" src={thumb} alt="" loading="lazy" /> : <span className="icon"><Icon size={22} aria-hidden /></span>}
			<div>
				<Meta>
					<Tag>{L.mode(type, h?.Mode ?? j?.Mode)}</Tag>
					<span>{L.enum(type === "housing" ? "housingKind" : "jobSector", post.Topic)}</span>
					{post.Deal && post.Deal !== "open" && <Tag $tone={post.Deal === "closed" ? "done" : "warning"}>{L.deal(post.Deal)}</Tag>}
				</Meta>
				<h3>{post.Title}</h3>
				<strong>{h ? L.rent(h) : j ? L.wage(j) : ""}</strong>
				<Meta style={{ marginTop: 4 }}>
					{h && <span>{L.moveIn(h.AvailableFrom)}</span>}
					{h?.Furnished && <span>{t("furnished")}</span>}
					{h?.Caf && <span>CAF</span>}
					{j && <span>{L.enum("employment", j.Employment)}</span>}
					{j?.PermitRequired && <span>{t("permit")}</span>}
					<span><MapPin size={12} aria-hidden /> {post.AreaName || L.enum("region", post.City)}</span>
					<span><TimeAgo ts={Math.max(post.BumpedAt ?? 0, post.CreatedAt)} /></span>
				</Meta>
			</div>
		</ListingCard>
	);
}

export function ListingList({ posts }: { posts: Post[] }) {
	return (
		<ListingCards>
			{posts.map(p => <li key={p.PostId}><ListingRow post={p} /></li>)}
		</ListingCards>
	);
}
