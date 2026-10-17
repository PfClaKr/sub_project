'use client';

import Link from "next/link";
import { BedDouble, Briefcase, MapPin } from "lucide-react";
import { dealLabel, LISTING_PATH, modeLabel, moveInLabel, rentLabel, wageLabel } from "@/libs/listing";
import { imageUrl } from "@/libs/format";
import { ListingCard, ListingCards } from "@/styles/styledListing";
import { Meta, Tag } from "@/styles/styledCommunity";
import type { ListingType } from "@/libs/constants";
import type { Post } from "@/libs/types";
import { TimeAgo } from "@/components/ui/TimeAgo";

export function ListingRow({ post }: { post: Post }) {
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
					<Tag>{modeLabel(type, h?.Mode ?? j?.Mode)}</Tag>
					<span>{post.Topic}</span>
					{post.Deal && post.Deal !== "open" && <Tag $tone={post.Deal === "closed" ? "done" : "warning"}>{dealLabel(post.Deal)}</Tag>}
				</Meta>
				<h3>{post.Title}</h3>
				<strong>{h ? rentLabel(h) : j ? wageLabel(j) : ""}</strong>
				<Meta style={{ marginTop: 4 }}>
					{h && <span>{moveInLabel(h.AvailableFrom)}</span>}
					{h?.Furnished && <span>가구 포함</span>}
					{h?.Caf && <span>CAF</span>}
					{j && <span>{j.Employment}</span>}
					{j?.PermitRequired && <span>체류증 필요</span>}
					<span><MapPin size={12} aria-hidden /> {post.AreaName || post.City}</span>
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
