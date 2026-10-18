'use client';

import { useCallback, useEffect, useState, FormEvent } from "react";
import { Bell, Camera, FileText, Heart, MessageCircle, PlusSquare, Settings } from "lucide-react";
import { useNotifications } from "@/libs/notifications";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { TextButton } from "@/styles/styledCommunity";
import { API_URL } from "@/libs/config";
import { isArrivalHidden, setArrivalHidden } from "@/libs/arrival";
import { AvatarPicker } from "@/styles/styledUi";
import { useSession } from "@/libs/session";
import { gql, PRODUCT_CARD_FIELDS } from "@/libs/graphql";
import { uploadImages } from "@/libs/upload";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { MyActivity } from "@/components/community/MyActivity";
import { ChangePasswordForm } from "@/components/auth/PasswordForms";
import { Avatar } from "@/components/ui/Avatar";
import ProductGrid, { ProductGridSkeleton } from "@/components/product/ProductGrid";
import { Section, SectionTitle, Row } from "@/styles/styledLayout";
import { FieldLabel } from "@/styles/styledForm";
import { EmptyState, ErrorText, GhostButton, LinkButton, MenuGrid, MenuTile, Muted } from "@/styles/styledUi";
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
	return <ProductGrid products={products} showSeller={false} />;
}

// Shortcuts the phone header has no room for (logout, wishlist, alerts).
function AccountLinks() {
	const { logout } = useSession();
	const { unread } = useNotifications();
	// Full reload: drops pages cached for the logged-in user.
	const handleLogout = async () => {
		await logout();
		window.location.assign("/");
	};
	return (
		<>
			<MenuGrid aria-label="바로가기">
				<li><MenuTile href="/sell"><PlusSquare size={22} aria-hidden />판매하기</MenuTile></li>
				<li><MenuTile href="/wishlist"><Heart size={22} aria-hidden />찜 목록</MenuTile></li>
				<li><MenuTile href="/chat"><MessageCircle size={22} aria-hidden />채팅</MenuTile></li>
				<li>
					<MenuTile href="/notifications">
						<Bell size={22} aria-hidden />알림
						{unread > 0 && <span className="count" aria-label={`읽지 않은 알림 ${unread}개`}>{unread > 99 ? "99+" : unread}</span>}
					</MenuTile>
				</li>
				<li><MenuTile href="#activity"><FileText size={22} aria-hidden />내 글</MenuTile></li>
				<li><MenuTile href="/myaccount/notifications"><Settings size={22} aria-hidden />알림 설정</MenuTile></li>
			</MenuGrid>
			<Row style={{ justifyContent: "flex-end", marginTop: 8 }}>
				<GhostButton onClick={handleLogout} style={{ border: "none" }}>로그아웃</GhostButton>
			</Row>
		</>
	);
}

// LeaveButton deletes the account after a typed confirmation
// (DELETE /account on the apiserver; what is kept is in the privacy policy).
function LeaveButton() {
	const confirm = useConfirm();
	const [error, setError] = useState("");
	const leave = async () => {
		const ok = await confirm({
			title: "정말 탈퇴할까요?",
			message: "계정, 올린 상품과 사진, 찜과 알림이 바로 삭제되고 되돌릴 수 없어요. 커뮤니티 글과 댓글은 '탈퇴한 회원'으로 남으니, 지우고 싶은 글은 먼저 삭제해주세요. 채팅과 신고 기록은 분쟁 대응을 위해 1년 보관 후 삭제돼요.",
			confirmLabel: "탈퇴하기",
			danger: true,
			requireText: "탈퇴",
			requireLabel: "확인을 위해 '탈퇴'를 입력해주세요",
		});
		if (!ok) return;
		const res = await fetch(`${API_URL}/account`, { method: "DELETE", credentials: "include" }).catch(() => null);
		if (!res?.ok) {
			const json = await res?.json().catch(() => null);
			setError(json?.error ?? "탈퇴하지 못했어요. 잠시 후 다시 시도해주세요.");
			return;
		}
		// Full reload: no page keeps the deleted member's data.
		window.location.assign("/?left=1");
	};
	return (
		<>
			<TextButton type="button" onClick={leave}>회원 탈퇴</TextButton>
			{error && <ErrorText role="alert">{error}</ErrorText>}
		</>
	);
}

// Account settings: password change, blocked users, leaving.
function AccountSettings() {
	const [open, setOpen] = useState(false);
	const [done, setDone] = useState("");
	const [arrivalHidden, setArrivalHiddenState] = useState(false);
	useEffect(() => setArrivalHiddenState(isArrivalHidden()), []);
	// After a reset the page opens with ?reset=1 (read here rather than with
	// useSearchParams, which would need a Suspense boundary on this page).
	useEffect(() => {
		if (new URLSearchParams(window.location.search).get("reset") === "1") setDone("비밀번호를 새로 정했어요.");
	}, []);
	return (
		<Section id="account">
			<SectionTitle>계정</SectionTitle>
			{done && <Muted as="p" role="status">{done}</Muted>}
			{open
				? <ChangePasswordForm onDone={() => { setOpen(false); setDone("비밀번호를 바꿨어요."); }} />
				: (
					<Row style={{ gap: 8, flexWrap: "wrap" }}>
						<GhostButton onClick={() => { setOpen(true); setDone(""); }}>비밀번호 변경</GhostButton>
						<LinkButton href="/myaccount/blocked" $ghost>차단한 사용자</LinkButton>
						{arrivalHidden && (
							<GhostButton onClick={() => { setArrivalHidden(false); setArrivalHiddenState(false); setDone("홈에 정착 체크리스트를 다시 보여드려요."); }}>
								정착 체크리스트 다시 보기
							</GhostButton>
						)}
					</Row>
				)}
			<div style={{ marginTop: 28 }}><LeaveButton /></div>
		</Section>
	);
}

export const MyAccount = () => (
	<RequireLogin>
		{session => (
			<>
				<ProfileEditor session={session} />
				<AccountLinks />
				<Section>
					<Row style={{ justifyContent: "space-between", marginBottom: 14 }}>
						<SectionTitle style={{ margin: 0 }}>내가 올린 상품</SectionTitle>
						<LinkButton href="/sell" $ghost>+ 새 상품</LinkButton>
					</Row>
					<MyProducts userId={session.UserId} />
				</Section>
				<Section id="activity">
					<SectionTitle>커뮤니티 활동</SectionTitle>
					<MyActivity />
				</Section>
				<AccountSettings />
			</>
		)}
	</RequireLogin>
);
