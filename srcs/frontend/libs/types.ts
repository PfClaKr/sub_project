export type Product = {
	ProductId: string;
	UserId?: string;
	SellerNickname?: string;
	ProductStatus?: string;
	ProductName: string;
	ProductDescription?: string;
	ProductPrice: number;
	ProductCategory?: string;
	ProductRegion?: string | null;
	ProductImage?: string[] | null;
	PreferedLocation?: string;
	// Map position. ExactLocation false = only the town / arrondissement
	// (AreaId, AreaName) is shown and Latitude/Longitude is its centre.
	Latitude?: number | null;
	Longitude?: number | null;
	ExactLocation?: boolean | null;
	AreaId?: string | null;
	AreaName?: string | null;
	ProductCreatedAt?: number;
	ProductUpdatedAt?: number;
};

export type User = {
	UserId: string;
	UserNickname?: string;
	ProfileImage?: string;
	Residence?: string;
	PublishedQuantity?: number;
	CreatedAt?: number;
};

export type Session = {
	UserId: string;
	UserNickname?: string;
	ProfileImage?: string;
	Residence?: string;
	// Only used to show the admin menu; the API checks the role itself.
	Role?: "admin";
	// Set while an admin suspension is in force; every service refuses
	// writes then. SuspendedUntil is in ms, 0 = until reinstated.
	Suspended?: boolean;
	SuspendedUntil?: number;
};

// What a chat room is about.
export type SubjectType = "product" | "housing" | "job";

export type Room = {
	ChatId: string;
	SubjectType: SubjectType;
	SubjectId: string;
	// Only on product rooms (older clients and links rely on it).
	ProductId?: string;
	SubjectTitle?: string;
	SubjectImage?: string;
	SubjectStatus?: string;
	UserSeller: string;
	UserBuyer: string;
	CreatedAt: number;
	ProductName?: string;
	ProductImage?: string;
	ProductStatus?: string;
	SellerNickname?: string;
	BuyerNickname?: string;
};

export type Message = {
	MessageId: string;
	ChatId: string;
	UserId: string;
	Timestamp: number;
	Content: string;
};

export type NotificationType =
	| "comment"
	| "reply"
	| "accepted"
	| "expiring"
	| "hidden"
	| "restored"
	| "chat"
	| "notice";

export type AppNotification = {
	SortKey: string;
	Type: NotificationType;
	ActorId?: string;
	TargetType?: string;
	TargetId?: string;
	Preview?: string;
	// Site path to open.
	Link?: string;
	Read: boolean;
	CreatedAt: number;
};
