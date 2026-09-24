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
