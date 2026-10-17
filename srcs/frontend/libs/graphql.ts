import { GRAPHQL_URL } from "@/libs/config";

export type GqlResult<T> = { data?: T; error?: string };

// gql posts a GraphQL operation. The session cookie is always sent so
// mutations run as the logged-in user (server components have no
// cookie and can only run public queries).
export async function gql<T>(
	query: string,
	variables: Record<string, unknown> = {},
	init: { timeoutMs?: number } = {},
): Promise<GqlResult<T>> {
	try {
		const res = await fetch(GRAPHQL_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query, variables }),
			credentials: "include",
			cache: "no-store",
			signal: init.timeoutMs ? AbortSignal.timeout(init.timeoutMs) : undefined,
		});
		if (!res.ok) return { error: "서버에 연결하지 못했어요." };
		const json = await res.json();
		if (json.errors?.length) return { data: json.data, error: json.errors[0].message };
		return { data: json.data };
	} catch {
		return { error: "서버에 연결하지 못했어요." };
	}
}

// Field list shared by every product card query.
export const PRODUCT_CARD_FIELDS = `
	ProductId
	UserId
	SellerNickname
	ProductStatus
	ProductName
	ProductPrice
	ProductImage
	PreferedLocation
	ProductCreatedAt
`;

// Field list shared by every community post list.
export const POST_LIST_FIELDS = `
	PostId
	Type
	Topic
	City
	Title
	BodyPreview
	AuthorNickname
	Anonymous
	CreatedAt
	CommentCount
	LikeCount
	Solved
`;

export const POST_DETAIL_FIELDS = `
	${POST_LIST_FIELDS}
	Body
	Images
	Status
	AuthorId
	AuthorImage
	IsMine
	UpdatedAt
	ViewCount
	AcceptedCommentId
	Liked
	Bookmarked
`;

// Housing/job lists and pages.
export const LISTING_CARD_FIELDS = `
	PostId
	Type
	Topic
	City
	Title
	Images
	AuthorNickname
	CreatedAt
	BumpedAt
	Deal
	AreaName
	Latitude
	Longitude
	Housing { Mode Kind Rent ChargesIncluded AvailableFrom Furnished Caf }
	Job { Mode Sector Employment WageType Wage PermitRequired }
`;

export const LISTING_DETAIL_FIELDS = `
	PostId
	Type
	Topic
	City
	Title
	Body
	Images
	Status
	AuthorId
	AuthorNickname
	AuthorImage
	IsMine
	CreatedAt
	UpdatedAt
	BumpedAt
	ViewCount
	Deal
	ExpiresAt
	AreaId
	AreaName
	Latitude
	Longitude
	ExactLocation
	HasContact
	Bookmarked
	Housing { Mode Kind Rent ChargesIncluded Deposit AvailableFrom EndDate MinMonths Size Rooms Furnished Caf Pets }
	Job { Mode Sector Employment WageType Wage Schedule PermitRequired Languages }
`;
