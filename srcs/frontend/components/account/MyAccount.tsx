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
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLabels } from "@/libs/labels";

function ProfileEditor({ session }: { session: Session }) {
	const t = useTranslations("account");
	const L = useLabels();
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
			setError(error ?? t("saveError"));
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
			setError(e instanceof Error ? e.message : t("photoError"));
		}
	};

	return (
		<Row style={{ gap: 16, alignItems: "flex-start" }}>
			<AvatarPicker title={t("changePhoto")} aria-busy={busy}>
				<Avatar src={session.ProfileImage} name={session.UserNickname} size={72} />
				<span className="badge" aria-hidden><Camera size={14} /></span>
				<span className="sr-only">{t("changePhoto")}</span>
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
							<span className="sr-only">{t("nickname")}</span>
							<input name="nickname" defaultValue={session.UserNickname} minLength={2} maxLength={20} required autoFocus />
						</FieldLabel>
						<button type="submit" disabled={busy}>{t("save")}</button>
						<GhostButton type="button" onClick={() => setEditing(false)}>{t("cancel")}</GhostButton>
					</form>
				) : (
					<Row>
						<strong style={{ fontSize: 20 }}>{session.UserNickname}</strong>
						<GhostButton onClick={() => setEditing(true)}>{t("changeNickname")}</GhostButton>
					</Row>
				)}
				<Muted>
					{session.Residence ? `${L.enum("region", session.Residence)} · ` : ""}{t("photoTip")}
				</Muted>
				{error && <ErrorText role="alert">{error}</ErrorText>}
			</div>
		</Row>
	);
}

function MyProducts({ userId }: { userId: string }) {
	const t = useTranslations("account");
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
				<p>{t("noItems")}</p>
				<LinkButton href="/sell">{t("firstItem")}</LinkButton>
			</EmptyState>
		);
	}
	return <ProductGrid products={products} showSeller={false} />;
}

// Shortcuts the phone header has no room for (logout, wishlist, alerts).
function AccountLinks() {
	const t = useTranslations("account");
	const { logout } = useSession();
	const { unread } = useNotifications();
	// Full reload: drops pages cached for the logged-in user.
	const handleLogout = async () => {
		await logout();
		window.location.assign("/");
	};
	return (
		<>
			<MenuGrid aria-label={t("shortcuts")}>
				<li><MenuTile href="/sell"><PlusSquare size={22} aria-hidden />{t("sell")}</MenuTile></li>
				<li><MenuTile href="/wishlist"><Heart size={22} aria-hidden />{t("wishlist")}</MenuTile></li>
				<li><MenuTile href="/chat"><MessageCircle size={22} aria-hidden />{t("chat")}</MenuTile></li>
				<li>
					<MenuTile href="/notifications">
						<Bell size={22} aria-hidden />{t("notifications")}
						{unread > 0 && <span className="count" aria-label={t("unread", { count: unread })}>{unread > 99 ? "99+" : unread}</span>}
					</MenuTile>
				</li>
				<li><MenuTile href="#activity"><FileText size={22} aria-hidden />{t("myPosts")}</MenuTile></li>
				<li><MenuTile href="/myaccount/notifications"><Settings size={22} aria-hidden />{t("notifySettings")}</MenuTile></li>
			</MenuGrid>
			<Row style={{ justifyContent: "flex-end", marginTop: 8 }}>
				<GhostButton onClick={handleLogout} style={{ border: "none" }}>{t("logout")}</GhostButton>
			</Row>
		</>
	);
}

// LeaveButton deletes the account after a typed confirmation
// (DELETE /account on the apiserver; what is kept is in the privacy policy).
function LeaveButton() {
	const t = useTranslations("account");
	const confirm = useConfirm();
	const [error, setError] = useState("");
	const leave = async () => {
		const ok = await confirm({
			title: t("leaveTitle"),
			message: t("leaveBody"),
			confirmLabel: t("leaveConfirm"),
			danger: true,
			requireText: t("leaveWord"),
			requireLabel: t("leaveLabel", { word: t("leaveWord") }),
		});
		if (!ok) return;
		const res = await fetch(`${API_URL}/account`, { method: "DELETE", credentials: "include" }).catch(() => null);
		if (!res?.ok) {
			const json = await res?.json().catch(() => null);
			setError(json?.error ?? t("leaveError"));
			return;
		}
		// Full reload: no page keeps the deleted member's data.
		window.location.assign("/?left=1");
	};
	return (
		<>
			<TextButton type="button" onClick={leave}>{t("leave")}</TextButton>
			{error && <ErrorText role="alert">{error}</ErrorText>}
		</>
	);
}

// Account settings: password change, blocked users, leaving.
function AccountSettings() {
	const t = useTranslations("account");
	const [open, setOpen] = useState(false);
	const [done, setDone] = useState("");
	const [arrivalHidden, setArrivalHiddenState] = useState(false);
	useEffect(() => setArrivalHiddenState(isArrivalHidden()), []);
	// After a reset the page opens with ?reset=1 (read here rather than with
	// useSearchParams, which would need a Suspense boundary on this page).
	useEffect(() => {
		if (new URLSearchParams(window.location.search).get("reset") === "1") setDone(t("passwordReset"));
	}, [t]);
	return (
		<Section id="account">
			<SectionTitle>{t("title")}</SectionTitle>
			{done && <Muted as="p" role="status">{done}</Muted>}
			{open
				? <ChangePasswordForm onDone={() => { setOpen(false); setDone(t("passwordChanged")); }} />
				: (
					<Row style={{ gap: 8, flexWrap: "wrap" }}>
						<GhostButton onClick={() => { setOpen(true); setDone(""); }}>{t("changePassword")}</GhostButton>
						<LinkButton href="/myaccount/blocked" $ghost>{t("blocked")}</LinkButton>
						{arrivalHidden && (
							<GhostButton onClick={() => { setArrivalHidden(false); setArrivalHiddenState(false); setDone(t("checklistBack")); }}>
								{t("showChecklist")}
							</GhostButton>
						)}
					</Row>
				)}
			<div style={{ marginTop: 16 }}>
				<Muted as="div" style={{ fontSize: 13, fontWeight: 700 }}>{t("language")}</Muted>
				<LanguageSwitcher />
			</div>
			<div style={{ marginTop: 28 }}><LeaveButton /></div>
		</Section>
	);
}

export function MyAccount() {
	const t = useTranslations("account");
	return (
		<RequireLogin>
			{session => (
				<>
					<ProfileEditor session={session} />
					<AccountLinks />
					<Section>
						<Row style={{ justifyContent: "space-between", marginBottom: 14 }}>
							<SectionTitle style={{ margin: 0 }}>{t("myItems")}</SectionTitle>
							<LinkButton href="/sell" $ghost>{t("newItem")}</LinkButton>
						</Row>
						<MyProducts userId={session.UserId} />
					</Section>
					<Section id="activity">
						<SectionTitle>{t("activity")}</SectionTitle>
						<MyActivity />
					</Section>
					<AccountSettings />
				</>
			)}
		</RequireLogin>
	);
}
