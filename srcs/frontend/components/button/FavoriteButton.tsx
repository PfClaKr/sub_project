'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/libs/config";

export const FavoriteButton = ({ productId }: { productId: string }) => {
	const router = useRouter();
	// null = unknown (not logged in or still loading)
	const [favorited, setFavorited] = useState<boolean | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		fetch(`${API_URL}/favorites/${productId}`, { credentials: 'include' })
			.then(res => res.ok ? res.json() : null)
			.then(json => setFavorited(json ? json.favorited : null))
			.catch(() => setFavorited(null));
	}, [productId]);

	const toggle = async () => {
		setBusy(true);
		try {
			const res = await fetch(`${API_URL}/favorites/${productId}`, {
				method: favorited ? 'DELETE' : 'POST',
				credentials: 'include',
			});
			if (res.status === 401) {
				router.push('/login');
				return;
			}
			if (res.ok) {
				const json = await res.json();
				setFavorited(json.favorited);
			}
		} finally {
			setBusy(false);
		}
	};

	return (
		<button onClick={toggle} disabled={busy}>
			{favorited ? "♥ 관심목록에서 빼기" : "♡ 관심목록 저장"}
		</button>
	);
};
