'use client';

import { useCallback, useEffect, useState, FormEvent } from "react";
import { Camera } from "lucide-react";
import { AvatarPicker } from "@/styles/styledUi";
import { useSession } from "@/libs/session";
import { gql, PRODUCT_CARD_FIELDS } from "@/libs/graphql";
import { uploadImages } from "@/libs/upload";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { Avatar } from "@/components/ui/Avatar";
import ProductGrid, { ProductGridSkeleton } from "@/components/product/ProductGrid";
import { Section, SectionTitle, Row } from "@/styles/styledLayout";
import { FieldLabel } from "@/styles/styledForm";
import { EmptyState, ErrorText, GhostButton, LinkButton, Muted } from "@/styles/styledUi";
import type { Product, Session } from "@/libs/types";

function ProfileEditor({ session }: { session: Session }) {
	const { refresh } = useSession();
	const [editing, setEditing] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const save = async (nickname: string, image?: string) => {
		setBusy(true);
		setError("");
		const { data, error } = await gql<{ updateProfile: { UserNickname: string } }>(
			`mutation P($nickname: String!, $image: String) {
				updateProfile(UserNickname: $nickname, ProfileImage: $image) { UserNickname }
			}`,
			{ nickname, image },
		);
		setBusy(false);
		if (!data?.updateProfile) {
			setError(error ?? "저장하지 못했어요.");
			return false;
		}
		await refresh();
		return true;
	};

	const handleNickname = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const nickname = String(new FormData(event.currentTarget).get("nickname") ?? "");
		if (await save(nickname)) setEditing(false);
	};

	const handleImage = async (file?: File) => {
		if (!file) return;
		try {
			setBusy(true);
			const [url] = await uploadImages([file]);
			await save(session.UserNickname ?? "", url);
		} catch (e) {
			setBusy(false);
			setError(e instanceof Error ? e.message : "사진을 올리지 못했어요.");
		}
	};

	return (
		<Row style={{ gap: 16, alignItems: "flex-start" }}>
			<AvatarPicker title="프로필 사진 바꾸기" aria-busy={busy}>
				<Avatar src={session.ProfileImage} name={session.UserNickname} size={72} />
				<span className="badge" aria-hidden><Camera size={14} /></span>
				<span className="sr-only">프로필 사진 바꾸기</span>
				<input
					type="file"
					accept="image/jpeg,image/png,image/gif,image/webp"
					className="sr-only"
					disabled={busy}
					onChange={e => handleImage(e.target.files?.[0])}
				/>
			</AvatarPicker>
			<div style={{ flex: 1, minWidth: 200 }}>
				{editing ? (
					<form onSubmit={handleNickname} style={{ display: "flex", gap: 8, maxWidth: 360 }}>
						<FieldLabel style={{ flex: 1 }}>
							<span className="sr-only">닉네임</span>
							<input name="nickname" defaultValue={session.UserNickname} minLength={2} maxLength={20} required autoFocus />
						</FieldLabel>
						<button type="submit" disabled={busy}>저장</button>
						<GhostButton type="button" onClick={() => setEditing(false)}>취소</GhostButton>
					</form>
				) : (
					<Row>
						<strong style={{ fontSize: 20 }}>{session.UserNickname}</strong>
						<GhostButton onClick={() => setEditing(true)}>닉네임 변경</GhostButton>
					</Row>
				)}
				<Muted>
					{session.Residence ? `${session.Residence} · ` : ""}프로필 사진을 눌러 바꿀 수 있어요.
				</Muted>
				{error && <ErrorText role="alert">{error}</ErrorText>}
			</div>
		</Row>
	);
}

function MyProducts({ userId }: { userId: string }) {
	const [products, setProducts] = useState<Product[] | null>(null);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		const { data, error } = await gql<{ userProducts: Product[] }>(
			`query Mine($userId: String!) { userProducts(UserId: $userId) { ${PRODUCT_CARD_FIELDS} } }`,
			{ userId },
		);
		if (error) setError(error);
		setProducts(data?.userProducts ?? []);
	}, [userId]);

	useEffect(() => {
		load();
	}, [load]);

	if (error) return <ErrorText>{error}</ErrorText>;
	if (products === null) return <ProductGridSkeleton count={4} />;
	if (products.length === 0) {
		return (
			<EmptyState>
				<p>아직 올린 상품이 없어요.</p>
				<LinkButton href="/sell">첫 상품 올리기</LinkButton>
			</EmptyState>
		);
	}
	return <ProductGrid products={products} />;
}

export const MyAccount = () => (
	<RequireLogin>
		{session => (
			<>
				<ProfileEditor session={session} />
				<Section>
					<Row style={{ justifyContent: "space-between", marginBottom: 14 }}>
						<SectionTitle style={{ margin: 0 }}>내가 올린 상품</SectionTitle>
						<LinkButton href="/sell" $ghost>+ 새 상품</LinkButton>
					</Row>
					<MyProducts userId={session.UserId} />
				</Section>
			</>
		)}
	</RequireLogin>
);
