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
};

export type Room = {
	ChatId: string;
	ProductId: string;
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
