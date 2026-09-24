'use client';

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { API_URL } from "@/libs/config";
import { useSession } from "@/libs/session";
import { GhostButton } from "@/styles/styledUi";

export const FavoriteButton = ({ productId }: { productId: string }) => {
	const { session } = useSession();
	const router = useRouter();
	const pathname = usePathname();
	const [favorited, setFavorited] = useState(false);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!session) {
			setFavorited(false);
			return;
		}
		fetch(`${API_URL}/favorites/${productId}`, { credentials: "include" })
			.then(res => (res.ok ? res.json() : null))
			.then(json => setFavorited(!!json?.favorited))
			.catch(() => setFavorited(false));
	}, [productId, session]);

	const toggle = async () => {
		if (!session) {
			router.push(`/login?next=${encodeURIComponent(pathname)}`);
			return;
		}
		setBusy(true);
		try {
			const res = await fetch(`${API_URL}/favorites/${productId}`, {
				method: favorited ? "DELETE" : "POST",
				credentials: "include",
			});
			if (res.status === 401) {
				router.push(`/login?next=${encodeURIComponent(pathname)}`);
				return;
			}
			if (res.ok) setFavorited((await res.json()).favorited);
		} catch {
			// Keep the current state; the user can retry.
		} finally {
			setBusy(false);
		}
	};

	return (
		<GhostButton onClick={toggle} disabled={busy} aria-pressed={favorited}>
			<Heart size={16} fill={favorited ? "currentColor" : "none"} aria-hidden />
			{favorited ? "찜 해제" : "찜하기"}
		</GhostButton>
	);
};
