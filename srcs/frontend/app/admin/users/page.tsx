import { getLocale, getTranslations } from "next-intl/server";
import { pageMetadata } from "@/libs/meta";
import type { Locale } from "@/i18n/config";
import Link from "next/link";
import { AdminListFilters } from "@/components/admin/AdminListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { RoleControl, SuspensionControl, UserDeleteControl } from "@/components/admin/Controls";
import { Avatar } from "@/components/ui/Avatar";
import { adminGet, currentSession, isAdmin, type AdminPage } from "@/libs/adminApi";
import { apiQuery, param, type SearchParams } from "@/libs/adminParams";
import { formatDate } from "@/libs/format";
import { EmptyRow, Panel, RoleBadge, Table, TableWrap, Who } from "@/styles/styledAdmin";

export const generateMetadata = pageMetadata("admin.users");

type User = {
	UserId: string; UserNickname: string; Email: string; Role: string;
	ProfileImage: string; CreatedAt: number; PublishedQuantity: number;
	Status: "active" | "suspended"; SuspendedUntil: number;
};

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
	if (!(await isAdmin())) return null;
	const [list, me] = await Promise.all([
		adminGet<AdminPage<User>>(`/users${apiQuery(searchParams, ["q", "role", "status", "page"])}`),
		currentSession(),
	]);
	const t = await getTranslations("admin");
	const locale = (await getLocale()) as Locale;

	return (
		<Panel>
			<h2>{t("users.title")}</h2>
			<AdminListFilters
				search={param(searchParams, "q")}
				placeholder={t("users.placeholder")}
				selects={[{
					name: "role", label: t("users.role"), value: param(searchParams, "role"),
					options: [{ value: "", label: t("all") }, { value: "user", label: t("users.member") }, { value: "admin", label: t("users.admin") }],
				}, {
					name: "status", label: t("users.status"), value: param(searchParams, "status"),
					options: [{ value: "", label: t("all") }, { value: "active", label: t("users.active") }, { value: "suspended", label: t("users.suspended") }],
				}]}
			/>
			<TableWrap>
				<Table>
					<thead>
						<tr><th>{t("users.colMember")}</th><th>{t("users.colEmail")}</th><th>{t("users.colRole")}</th><th>{t("users.colItems")}</th><th>{t("users.colJoined")}</th><th>{t("users.colSuspension")}</th><th>{t("users.colManage")}</th></tr>
					</thead>
					<tbody>
						{list.Items.map(u => {
							const self = u.UserId === me?.UserId;
							return (
								<tr key={u.UserId}>
									<td>
										<Who>
											<Avatar src={u.ProfileImage} name={u.UserNickname} size={32} />
											<Link href={`/user/${u.UserId}`}>{u.UserNickname || t("noNickname")}</Link>
										</Who>
									</td>
									<td data-label={t("users.colEmail")}>{u.Email || "—"}</td>
									<td data-label={t("users.colRole")}>
										{self
											? <RoleBadge $admin>{t("users.me")}</RoleBadge>
											: <RoleControl userId={u.UserId} role={u.Role} />}
									</td>
									<td data-label={t("users.colItems")}>
										<Link href={`/admin/products?q=${encodeURIComponent(u.Email || u.UserNickname)}`}>
											{t("users.items", { count: u.PublishedQuantity })}
										</Link>
									</td>
									<td data-label={t("users.colJoined")}>{formatDate(u.CreatedAt, locale)}</td>
									<td data-label={t("users.colSuspension")}>
										{self || u.Role === "admin"
											? "—"
											: <SuspensionControl userId={u.UserId} nickname={u.UserNickname} suspended={u.Status === "suspended"} until={u.SuspendedUntil} />}
									</td>
									<td>
										{self || u.Role === "admin"
											? null
											: <UserDeleteControl userId={u.UserId} email={u.Email} nickname={u.UserNickname} />}
									</td>
								</tr>
							);
						})}
					</tbody>
				</Table>
				{list.Items.length === 0 && <EmptyRow>{t("users.empty")}</EmptyRow>}
			</TableWrap>
			<AdminPagination pathname="/admin/users" params={searchParams} page={list.Page} totalPages={list.TotalPages} total={list.Total} />
		</Panel>
	);
}
