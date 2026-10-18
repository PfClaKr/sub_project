import { getLocale, getTranslations } from "next-intl/server";
import { adminGet, isAdmin } from "@/libs/adminApi";
import { getLabels } from "@/libs/labels.server";
import { Panel, StatGrid, StatTile } from "@/styles/styledAdmin";

type Stats = {
	Users: number; Admins: number; NewUsers7d: number;
	Products: number; Selling: number; Reserved: number; Sold: number; NewProducts7d: number;
	ChatRooms: number; Messages: number; Messages7d: number;
	Posts: number; Questions: number; Listings: number; HiddenPosts: number;
	OpenReports: number; FlaggedPosts: number;
};

// Every tile links to the list it counts, as in the ineverywhere admin:
// a number you cannot click is a dead end.
export default async function AdminOverviewPage() {
	if (!(await isAdmin())) return null;
	const s = await adminGet<Stats>("/stats");
	const t = await getTranslations("admin");
	const L = await getLabels();
	const locale = await getLocale();
	const tiles = [
		{ label: t("stats.openReports"), value: s.OpenReports, href: "/admin/reports" },
		{ label: t("stats.flagged"), value: s.FlaggedPosts, href: "/admin/posts?flagged=1" },
		{ label: t("stats.hidden"), value: s.HiddenPosts, href: "/admin/posts?status=hidden" },
		{ label: t("stats.posts"), value: s.Posts, sub: t("stats.postsSub", { questions: s.Questions, listings: s.Listings }), href: "/admin/posts" },
		{ label: t("stats.users"), value: s.Users, sub: t("stats.newSub", { count: s.NewUsers7d }), href: "/admin/users" },
		{ label: t("stats.admins"), value: s.Admins, href: "/admin/users?role=admin" },
		{ label: t("stats.products"), value: s.Products, sub: t("stats.newSub", { count: s.NewProducts7d }), href: "/admin/products" },
		{ label: L.enum("status", "판매중"), value: s.Selling, href: "/admin/products?status=판매중" },
		{ label: L.enum("status", "예약중"), value: s.Reserved, href: "/admin/products?status=예약중" },
		{ label: L.enum("status", "판매완료"), value: s.Sold, href: "/admin/products?status=판매완료" },
		{ label: t("stats.rooms"), value: s.ChatRooms, href: "/admin/conversations" },
		{ label: t("stats.messages"), value: s.Messages, sub: t("stats.messagesSub", { count: s.Messages7d }), href: "/admin/conversations" },
	];
	return (
		<Panel>
			<h2>{t("nav.overview")}</h2>
			<StatGrid>
				{tiles.map(tile => (
					<StatTile key={tile.href + tile.label} href={tile.href}>
						<span>{tile.label}</span>
						<strong>{tile.value.toLocaleString(locale)}</strong>
						{tile.sub && <small>{tile.sub}</small>}
					</StatTile>
				))}
			</StatGrid>
		</Panel>
	);
}
