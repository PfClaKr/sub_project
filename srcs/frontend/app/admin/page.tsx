import { adminGet, isAdmin } from "@/libs/adminApi";
import { Panel, StatGrid, StatTile } from "@/styles/styledAdmin";

type Stats = {
	Users: number; Admins: number; NewUsers7d: number;
	Products: number; Selling: number; Reserved: number; Sold: number; NewProducts7d: number;
	ChatRooms: number; Messages: number; Messages7d: number;
};

// Every tile links to the list it counts, as in the ineverywhere admin:
// a number you cannot click is a dead end.
export default async function AdminOverviewPage() {
	if (!(await isAdmin())) return null;
	const s = await adminGet<Stats>("/stats");
	const tiles = [
		{ label: "전체 회원", value: s.Users, sub: `최근 7일 +${s.NewUsers7d}`, href: "/admin/users" },
		{ label: "관리자", value: s.Admins, href: "/admin/users?role=admin" },
		{ label: "전체 상품", value: s.Products, sub: `최근 7일 +${s.NewProducts7d}`, href: "/admin/products" },
		{ label: "판매중", value: s.Selling, href: "/admin/products?status=판매중" },
		{ label: "예약중", value: s.Reserved, href: "/admin/products?status=예약중" },
		{ label: "판매완료", value: s.Sold, href: "/admin/products?status=판매완료" },
		{ label: "채팅방", value: s.ChatRooms, href: "/admin/conversations" },
		{ label: "메시지", value: s.Messages, sub: `최근 7일 ${s.Messages7d}개`, href: "/admin/conversations" },
	];
	return (
		<Panel>
			<h2>개요</h2>
			<StatGrid>
				{tiles.map(t => (
					<StatTile key={t.label} href={t.href}>
						<span>{t.label}</span>
						<strong>{t.value.toLocaleString("ko-KR")}</strong>
						{t.sub && <small>{t.sub}</small>}
					</StatTile>
				))}
			</StatGrid>
		</Panel>
	);
}
