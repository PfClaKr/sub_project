import { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Section, SectionTitle } from "@/styles/styledLayout";
import { SafetyList } from "@/components/listing/SafetyList";

export const metadata: Metadata = {
	title: "안전 가이드",
	description: "집 구하기·알바·중고거래에서 자주 일어나는 사기 수법과 피하는 방법, 신고처를 정리했어요.",
};

// Static guide linked from every housing/job page. Official contacts are
// links to the official sites rather than copied numbers, so they stay
// current; check them before launch (docs/community-plan.md 12).
export default function Page() {
	return (
		<div style={{ maxWidth: 760 }}>
			<PageHeader>
				<h1>안전 가이드</h1>
				<p>해외에서는 피해를 되돌리기가 훨씬 어려워요. 아래 수칙만 지켜도 대부분의 사기를 피할 수 있어요.</p>
			</PageHeader>

			<Section>
				<SectionTitle>집 구하기</SectionTitle>
				<SafetyList items={[
					["집을 보기 전에 돈을 보내지 마세요", "보증금·예약금·'열쇠 보내주는 비용'을 먼저 요구하면 거의 확실한 사기예요. 직접 방문하거나 믿을 수 있는 사람이 대신 보고, 계약서(bail)를 쓴 뒤에 내세요."],
					["너무 싼 집, 급하게 재촉하는 집주인", "시세보다 훨씬 싸거나 '해외에 있어서 직접 못 보여준다', '오늘 안에 결정해야 한다'는 말은 대표적인 수법이에요."],
					["외부 메신저로 옮기자는 요청", "카톡·텔레그램·왓츠앱으로 옮기면 기록이 남지 않아 신고가 어려워요. 잇냥 채팅에서 대화하세요."],
					["서류는 필요한 만큼만", "여권·체류증 사본을 보낼 때는 '임대 서류용' 같은 워터마크를 넣으세요. 계약 전에 은행 계좌 접근 정보를 주면 안 돼요."],
				]} />
			</Section>

			<Section>
				<SectionTitle>알바·구인구직</SectionTitle>
				<SafetyList items={[
					["일하기 전에 돈을 내라는 곳은 피하세요", "교육비·유니폼비·등록비를 먼저 요구하면 사기예요."],
					["신분증·계좌 사진을 구글 폼으로?", "면접도 보기 전에 신분증과 계좌 정보를 받아가는 경우가 있어요. 실제 가게인지, 주소와 연락처를 먼저 확인하세요."],
					["계약서와 급여 명세서", "프랑스에서는 신고된 고용(contrat, fiche de paie)이 원칙이에요. 시급이 최저임금(SMIC)보다 낮거나 현금만 준다면 다시 생각해보세요."],
				]} />
			</Section>

			<Section>
				<SectionTitle>중고거래</SectionTitle>
				<SafetyList items={[
					["직접 만나서, 공공장소에서", "역 근처나 카페처럼 사람이 많은 곳에서 물건을 확인하고 거래하세요."],
					["'귀국 처분'이라며 선입금 요구", "한국 계좌로 먼저 송금받고 연락이 끊기는 사례가 많아요. 택배 거래는 특히 조심하세요."],
				]} />
			</Section>

			<Section>
				<SectionTitle>피해를 입었다면</SectionTitle>
				<SafetyList items={[
					["잇냥에 신고하기", "글·댓글·채팅방의 '신고' 버튼을 눌러주세요. 운영진이 확인하고 작성자를 제한해요. 대화 내용과 송금 기록은 지우지 말고 보관하세요."],
					["프랑스 경찰·온라인 신고", "온라인 사기는 정부 신고 사이트(PHAROS, internet-signalement.gouv.fr)와 cybermalveillance.gouv.fr에서 신고·상담할 수 있어요. 금전 피해는 가까운 경찰서(commissariat)에 고소(plainte)할 수 있어요. 긴급 상황은 17 또는 112."],
					["대사관 영사 조력", "주프랑스 대한민국 대사관 영사과에서 사건 사고 관련 안내를 받을 수 있어요. 연락처는 대사관 공식 홈페이지에서 확인하세요."],
				]} />
				<p style={{ marginTop: 16 }}>
					<a href="https://www.internet-signalement.gouv.fr" target="_blank" rel="noopener noreferrer">PHAROS</a>
					{" · "}
					<a href="https://www.cybermalveillance.gouv.fr" target="_blank" rel="noopener noreferrer">cybermalveillance.gouv.fr</a>
					{" · "}
					<a href="https://overseas.mofa.go.kr/fr-ko/index.do" target="_blank" rel="noopener noreferrer">주프랑스 대한민국 대사관</a>
					{" · "}
					<Link href="/community?board=qna">커뮤니티에 물어보기</Link>
				</p>
			</Section>
		</div>
	);
}
