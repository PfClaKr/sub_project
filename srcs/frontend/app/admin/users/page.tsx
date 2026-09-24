import { Metadata } from "next";
import Link from "next/link";
import { AdminListFilters } from "@/components/admin/AdminListFilters";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { RoleControl, UserDeleteControl } from "@/components/admin/Controls";
import { Avatar } from "@/components/ui/Avatar";
import { adminGet, currentSession, isAdmin, type AdminPage } from "@/libs/adminApi";
import { apiQuery, param, type SearchParams } from "@/libs/adminParams";
import { formatDate } from "@/libs/format";
import { EmptyRow, Panel, RoleBadge, Table, TableWrap, Who } from "@/styles/styledAdmin";

export const metadata: Metadata = { title: "회원" };

type User = {
	UserId: string; UserNickname: string; Email: string; Role: string;
	ProfileImage: string; CreatedAt: number; PublishedQuantity: number;
};

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
	if (!(await isAdmin())) return null;
	const [list, me] = await Promise.all([
		adminGet<AdminPage<User>>(`/users${apiQuery(searchParams, ["q", "role", "page"])}`),
		currentSession(),
	]);

	return (
		<Panel>
			<h2>회원</h2>
			<AdminListFilters
				search={param(searchParams, "q")}
				placeholder="닉네임 또는 이메일"
				selects={[{
					name: "role", label: "권한", value: param(searchParams, "role"),
					options: [{ value: "", label: "전체" }, { value: "user", label: "회원" }, { value: "admin", label: "관리자" }],
				}]}
			/>
			<TableWrap>
				<Table>
					<thead>
						<tr><th>회원</th><th>이메일</th><th>권한</th><th>등록 상품</th><th>가입일</th><th>관리</th></tr>
					</thead>
					<tbody>
						{list.Items.map(u => {
							const self = u.UserId === me?.UserId;
							return (
								<tr key={u.UserId}>
									<td>
										<Who>
											<Avatar src={u.ProfileImage} name={u.UserNickname} size={32} />
											<Link href={`/user/${u.UserId}`}>{u.UserNickname || "(닉네임 없음)"}</Link>
										</Who>
									</td>
									<td>{u.Email || "—"}</td>
									<td>
										{self
											? <RoleBadge $admin>나 · 관리자</RoleBadge>
											: <RoleControl userId={u.UserId} role={u.Role} />}
									</td>
									<td>
										<Link href={`/admin/products?q=${encodeURIComponent(u.Email || u.UserNickname)}`}>
											{u.PublishedQuantity}개
										</Link>
									</td>
									<td>{formatDate(u.CreatedAt)}</td>
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
				{list.Items.length === 0 && <EmptyRow>조건에 맞는 회원이 없어요.</EmptyRow>}
			</TableWrap>
			<AdminPagination pathname="/admin/users" params={searchParams} page={list.Page} totalPages={list.TotalPages} total={list.Total} />
		</Panel>
	);
}
