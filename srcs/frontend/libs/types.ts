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

export type HousingInfo = {
	Mode: "offer" | "seek";
	Kind: string;
	Rent: number;
	ChargesIncluded?: boolean;
	Deposit?: number;
	AvailableFrom: string; // YYYY-MM-DD
	EndDate?: string;
	MinMonths?: number;
	Size?: number;
	Rooms?: number;
	Furnished?: boolean;
	Caf?: boolean;
	Pets?: boolean;
};

export type JobInfo = {
	Mode: "hiring" | "seeking";
	Sector: string;
	Employment: string;
	WageType: "hourly" | "monthly" | "negotiable";
	Wage?: number;
	Schedule?: string;
	PermitRequired?: boolean;
	Languages?: string[];
};

export type Post = {
	PostId: string;
	Type: "free" | "qna" | "housing" | "job";
	Topic: string;
	City?: string;
	Title: string;
	Body?: string;
	BodyPreview?: string;
	Images?: string[];
	Status?: "active" | "hidden" | "deleted" | "expired";
	Anonymous?: boolean;
	// Empty for anonymous posts.
	AuthorId?: string;
	AuthorNickname?: string;
	AuthorImage?: string;
	IsMine?: boolean;
	CreatedAt: number;
	UpdatedAt?: number;
	CommentCount?: number;
	LikeCount?: number;
	ViewCount?: number;
	AcceptedCommentId?: string;
	Solved?: boolean;
	Liked?: boolean;
	Bookmarked?: boolean;
	// Housing and job posts only.
	Housing?: HousingInfo;
	Job?: JobInfo;
	Deal?: "open" | "reserved" | "closed";
	ExpiresAt?: number;
	BumpedAt?: number;
	AreaId?: string;
	AreaName?: string;
	Latitude?: number;
	Longitude?: number;
	ExactLocation?: boolean;
	HasContact?: boolean;
};

export type PostPage = {
	Items: Post[];
	Page: number;
	TotalPages: number;
	Total: number;
	Corrected?: boolean;
};

export type PostComment = {
	CommentId: string;
	PostId?: string;
	ParentId?: string;
	Body: string;
	DisplayName: string;
	AuthorId?: string;
	AuthorImage?: string;
	Anonymous?: boolean;
	IsMine?: boolean;
	IsPostAuthor?: boolean;
	Deleted?: boolean;
	Accepted?: boolean;
	CreatedAt: number;
};
