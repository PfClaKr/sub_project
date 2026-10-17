'use client';

import { ShieldCheck } from "lucide-react";
import { PostRows } from "@/styles/styledCommunity";

export function SafetyList({ items }: { items: [string, string][] }) {
	return (
		<PostRows>
			{items.map(([title, text]) => (
				<li key={title} style={{ display: "flex", gap: 10, padding: "12px 0" }}>
					<ShieldCheck size={18} aria-hidden style={{ flex: "none", marginTop: 3, color: "#1d7a46" }} />
					<div>
						<strong>{title}</strong>
						<p style={{ margin: "4px 0 0", lineHeight: 1.6 }}>{text}</p>
					</div>
				</li>
			))}
		</PostRows>
	);
}
