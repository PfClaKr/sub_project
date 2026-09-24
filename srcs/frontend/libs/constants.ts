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
