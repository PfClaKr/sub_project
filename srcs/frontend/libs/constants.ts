// Must match graphqlhandler.Categories on the apiserver.
export const CATEGORIES = ["전자기기", "가구", "의류", "도서", "식품", "기타"] as const;

// Must match graphqlhandler.Regions on the apiserver.
export const REGIONS = ["파리", "일드프랑스", "리옹", "마르세유", "툴루즈", "스트라스부르", "니스", "프랑스 기타", "기타 유럽"] as const;
export const DEFAULT_REGION = "파리";

export const STATUSES = ["판매중", "예약중", "판매완료"] as const;
export const STATUS_SELLING = "판매중";

export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const PAGE_SIZE = 12;

// Community boards. Topics must match graphqlhandler.FreeTopics and
// QnaTopics on the apiserver.
export const FREE_TOPICS = ["일상", "정보", "맛집·장보기", "행사·모임", "고민"] as const;
export const QNA_TOPICS = ["체류증·비자", "행정·CAF·세금", "은행·통신", "학교·어학", "의료", "집·이사", "일·취업", "기타"] as const;

export type BoardType = "free" | "qna";
export const BOARDS: Record<BoardType, { label: string; topics: readonly string[] }> = {
	free: { label: "자유", topics: FREE_TOPICS },
	qna: { label: "생활 Q&A", topics: QNA_TOPICS },
};

// Must match graphqlhandler.ReportReasons.
export const REPORT_REASONS = ["사기 의심", "스팸·광고", "욕설·혐오", "개인정보 노출", "불법 행위", "기타"] as const;

export const POST_PAGE_SIZE = 20;

// Housing and job posts. Must match graphqlhandler.HousingKinds,
// JobSectors, EmploymentTypes and JobLanguages.
export const HOUSING_KINDS = ["쉐어", "스튜디오·원룸", "아파트 전체", "서블렛", "단기·민박"] as const;
export const JOB_SECTORS = ["식당·카페", "판매·매장", "사무", "과외·강사", "베이비시터", "가이드·통역", "기타"] as const;
export const EMPLOYMENT_TYPES = ["알바", "정규직", "인턴", "프리랜서"] as const;
export const JOB_LANGUAGES = ["한국어", "프랑스어", "영어"] as const;

export type ListingType = "housing" | "job";
export const LISTING_MODES = {
	housing: [{ value: "offer", label: "방 있어요" }, { value: "seek", label: "방 구해요" }],
	job: [{ value: "hiring", label: "구인" }, { value: "seeking", label: "구직" }],
} as const;

export const DEALS = [
	{ value: "open", label: "모집중" },
	{ value: "reserved", label: "예약중" },
	{ value: "closed", label: "완료" },
] as const;

export const MAX_LISTING_IMAGES = 8;
