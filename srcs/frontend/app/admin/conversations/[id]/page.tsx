import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminGet, isAdmin } from "@/libs/adminApi";
import { formatDateTime } from "@/libs/format";
import { Note, Panel, Transcript } from "@/styles/styledAdmin";
import { Breadcrumb } from "@/styles/styledDetail";
import type { AdminRoom } from "../page";

export const metadata: Metadata = { title: "채팅 기록" };

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

	return (
		<Panel>
			<Breadcrumb><Link href="/admin/conversations">← 채팅 목록</Link></Breadcrumb>
			<h2>{room.SellerNickname || "(탈퇴)"} · {room.BuyerNickname || "(탈퇴)"}</h2>
			<p>
				상품: {room.ProductName
					? <Link href={`/product/${room.ProductId}`}>{room.ProductName}</Link>
					: "(삭제된 상품)"}
				{" · "}{room.SellerEmail} / {room.BuyerEmail}
			</p>
			<Note>
				신고 처리, 분쟁 조정, 법적 요청 대응을 위한 화면이에요. 회원의 대화이므로 필요한 경우에만 열람해주세요.
				관리자는 이 대화에 메시지를 보낼 수 없어요.
			</Note>
			{messages.length === 0 ? <p>메시지가 없어요.</p> : (
				<Transcript>
					{messages.map(m => (
						<li key={m.MessageId} data-side={m.UserId === room.BuyerId ? "buyer" : "seller"}>
							<header>
								<strong>{m.Nickname || "(탈퇴)"} {m.UserId === room.SellerId ? "· 판매자" : "· 구매자"}</strong>
								<time>{formatDateTime(m.Timestamp)}</time>
							</header>
							<p>{m.Content}</p>
						</li>
					))}
				</Transcript>
			)}
		</Panel>
	);
}
