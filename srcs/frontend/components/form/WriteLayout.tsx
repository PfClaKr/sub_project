import Link from "next/link";
import { Check, Lightbulb } from "lucide-react";
import { TipsCard, WriteGrid } from "@/styles/styledForm";

type Kind = "product" | "qna" | "free" | "housing" | "job";

const TIPS: Record<Kind, { title: string; items: string[]; safety: string }> = {
	product: {
		title: "빨리 팔리는 글",
		items: [
			"밝은 곳에서 여러 각도로 찍은 사진을 올려주세요. 첫 사진이 목록에 보여요.",
			"제목에 브랜드와 모델명을 넣으면 검색에 잘 걸려요.",
			"비슷한 물건 가격을 찾아보고 정하면 문의가 빨리 와요.",
			"흠집이나 고장은 솔직하게 적어야 거래가 깔끔해요.",
		],
		safety: "직접 만나 물건을 확인하고 거래하세요. 선입금 요구는 받지도, 하지도 마세요.",
	},
	qna: {
		title: "답을 잘 받는 질문",
		items: [
			"제목에 궁금한 점을 한 문장으로 적어주세요.",
			"체류 자격, 사는 곳, 시기처럼 상황을 적으면 정확한 답이 와요.",
			"올리기 전에 비슷한 질문이 있는지 검색해보세요.",
			"도움이 된 답변은 채택해주세요. 다른 사람에게도 도움이 돼요.",
		],
		safety: "여권 번호, 체류증 번호, 집 주소 같은 개인정보는 올리지 마세요.",
	},
	free: {
		title: "함께 쓰는 게시판",
		items: [
			"서로 존중하는 말투로 써주세요.",
			"광고와 홍보 글은 숨겨질 수 있어요.",
			"사진에 다른 사람 얼굴이나 개인정보가 보이지 않게 해주세요.",
		],
		safety: "불편한 글은 '신고'를 눌러주세요. 운영진이 확인해요.",
	},
	housing: {
		title: "문의가 많은 방 글",
		items: [
			"실제 방 사진을 올려주세요. 방 있어요 글은 사진이 꼭 필요해요.",
			"월세, 관리비 포함 여부, 보증금을 정확히 적어주세요.",
			"입주 가능일과 최소 거주 기간을 적으면 맞는 사람만 연락해요.",
		],
		safety: "집을 보기 전에 돈을 보내거나 받지 마세요. 계약서(bail)를 쓰고 거래하세요.",
	},
	job: {
		title: "지원이 많은 공고",
		items: [
			"시급과 근무 시간을 구체적으로 적어주세요. 시급은 최저임금(SMIC) 이상이어야 해요.",
			"필요한 언어와 체류증 조건을 적어주세요.",
			"계약서와 급여 명세서를 주는지 적으면 신뢰가 올라가요.",
		],
		safety: "지원자에게 돈이나 신분증·계좌 사진을 먼저 요구하면 안 돼요.",
	},
};

// WriteLayout puts writing tips next to a form on wide screens.
export function WriteLayout({ kind, children }: { kind: Kind; children: React.ReactNode }) {
	const tips = TIPS[kind];
	return (
		<WriteGrid>
			<div>{children}</div>
			<TipsCard aria-label="작성 팁">
				<h2><Lightbulb size={18} aria-hidden /> {tips.title}</h2>
				<ul>
					{tips.items.map(t => <li key={t}><Check size={15} aria-hidden />{t}</li>)}
				</ul>
				<p className="safety">{tips.safety} <Link href="/safety">안전 가이드</Link></p>
			</TipsCard>
		</WriteGrid>
	);
}
