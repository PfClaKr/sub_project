'use client';

import { BedDouble, Briefcase } from "lucide-react";
import { ComingSoonBox } from "@/styles/styledNotification";

// Placeholder for sections still being built (docs/community-plan.md).
const CONTENT = {
	housing: {
		icon: BedDouble,
		title: "집 구하기를 준비하고 있어요",
		intro: "렌트·쉐어·서블렛을 조건으로 찾고 지도에서 동네를 확인할 수 있게 돼요.",
		points: ["월세·입주일·가구·CAF 가능 여부 필터", "동네 경계로 보는 위치", "잇냥 채팅으로 안전하게 문의"],
	},
	jobs: {
		icon: Briefcase,
		title: "알바 게시판을 준비하고 있어요",
		intro: "한인 가게 구인과 구직 글을 한곳에서 볼 수 있게 돼요.",
		points: ["업종·고용 형태·지역 필터", "시급과 근무 조건을 한눈에", "가입 후 일정 기간이 지난 회원만 작성"],
	},
} as const;

export function ComingSoon({ section }: { section: keyof typeof CONTENT }) {
	const c = CONTENT[section];
	const Icon = c.icon;
	return (
		<ComingSoonBox>
			<Icon size={36} aria-hidden />
			<h2>{c.title}</h2>
			<p>{c.intro}</p>
			<ul>
				{c.points.map(p => <li key={p}>{p}</li>)}
			</ul>
		</ComingSoonBox>
	);
}
