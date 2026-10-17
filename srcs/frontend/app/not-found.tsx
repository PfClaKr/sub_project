import { Metadata } from "next";
import { CatMascot } from "@/components/landing/CatMascot";
import { Chip, EmptyState, LinkButton } from "@/styles/styledUi";
import { Row } from "@/styles/styledLayout";
import { SECTIONS } from "@/libs/sections";

export const metadata: Metadata = {
	title: "페이지를 찾을 수 없어요",
};

export default function NotFound() {
	return (
		<EmptyState style={{ marginTop: 24 }}>
			<div style={{ width: 140, height: 140, margin: "0 auto" }} aria-hidden="true"><CatMascot /></div>
			<h1 style={{ fontSize: 22, margin: "12px 0 4px" }}>페이지를 찾을 수 없어요</h1>
			<p>삭제되었거나 주소가 잘못된 것 같아요.</p>
			<Row style={{ justifyContent: "center", flexWrap: "wrap", gap: 8, margin: "4px 0 16px" }}>
				{SECTIONS.map(s => <Chip key={s.href} href={s.href}>{s.label}</Chip>)}
			</Row>
			<LinkButton href="/">홈으로</LinkButton>
		</EmptyState>
	);
}
