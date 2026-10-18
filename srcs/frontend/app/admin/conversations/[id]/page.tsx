import { getLocale, getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import type { Locale } from "@/i18n/config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGet, isAdmin } from "@/libs/adminApi";
import { formatDateTime } from "@/libs/format";
import { Note, Panel, Transcript } from "@/styles/styledAdmin";
import { Breadcrumb } from "@/styles/styledDetail";
import type { AdminRoom } from "../page";

export const generateMetadata = pageMetadata("admin.transcript");

type Message = { MessageId: string; UserId: string; Nickname: string; Timestamp: number; Content: string };

// Read-only transcript. There is deliberately no reply box: an admin
// settling a dispute must not be able to post as a participant.
export default async function AdminConversationPage({ params }: { params: { id: string } }) {
	if (!(await isAdmin())) return null;
	let data: { Room: AdminRoom; Messages: Message[] };
	try {
		data = await adminGet(`/conversations/${encodeURIComponent(params.id)}`);
	} catch {
		notFound();
	}
	const { Room: room, Messages: messages } = data;
	const t = await getTranslations("admin");
	const locale = (await getLocale()) as Locale;

	return (
		<Panel>
			<Breadcrumb><Link href="/admin/conversations">{t("chats.back")}</Link></Breadcrumb>
			<h2>{room.SellerNickname || t("left")} · {room.BuyerNickname || t("left")}</h2>
			<p>
				{t("chats.item")}{room.ProductName
					? <Link href={`/product/${room.ProductId}`}>{room.ProductName}</Link>
					: t("deletedItem")}
				{" · "}{room.SellerEmail} / {room.BuyerEmail}
			</p>
			<Note>{t("chats.notice")}</Note>
			{messages.length === 0 ? <p>{t("chats.noMessages")}</p> : (
				<Transcript>
					{messages.map(m => (
						<li key={m.MessageId} data-side={m.UserId === room.BuyerId ? "buyer" : "seller"}>
							<header>
								<strong>{m.Nickname || t("left")} {m.UserId === room.SellerId ? t("chats.seller") : t("chats.buyer")}</strong>
								<time>{formatDateTime(m.Timestamp, locale)}</time>
							</header>
							<p>{m.Content}</p>
						</li>
					))}
				</Transcript>
			)}
		</Panel>
	);
}
