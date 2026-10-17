//go:build e2e

package e2e

import (
	"testing"
	"time"
)

// The home feed (Elasticsearch, newest first, paged), a seller's products
// (Product.UserIndex) and the home counters (index counts).
func TestProductFeeds(t *testing.T) {
	seller := signup(t, "feed-seller")
	older := newProduct(t, seller, "e2e 피드 오래된 "+runID, 10, "도서")
	time.Sleep(1100 * time.Millisecond) // creation times are in seconds
	newer := newProduct(t, seller, "e2e 피드 새로운 "+runID, 20, "도서")

	var feed struct{ RecentProducts []product }
	r := gql(t, newClient(), `query($c: String) { recentProducts(Limit: 50, Category: $c) { ProductId ProductName SellerNickname } }`, map[string]interface{}{"c": "도서"})
	r.field(t, "recentProducts", &feed.RecentProducts)
	got := ids(feed.RecentProducts)
	if len(got) < 2 || got[0] != newer.ProductId {
		t.Fatalf("category feed = %v, want the newest product first", got)
	}
	if !contains(got, older.ProductId) {
		t.Error("older product missing from its category feed")
	}
	if feed.RecentProducts[0].SellerNickname == "" {
		t.Error("feed lost the seller nickname")
	}
	var page2 []product
	gql(t, newClient(), `query($c: String) { recentProducts(Limit: 1, Offset: 1, Category: $c) { ProductId } }`, map[string]interface{}{"c": "도서"}).field(t, "recentProducts", &page2)
	if len(page2) != 1 || page2[0].ProductId != got[1] {
		t.Errorf("offset 1 = %v, want %s", ids(page2), got[1])
	}
	var other []product
	gql(t, newClient(), `{ recentProducts(Limit: 50, Category: "가구") { ProductId } }`, nil).field(t, "recentProducts", &other)
	if contains(ids(other), newer.ProductId) {
		t.Error("category filter ignored")
	}

	// The 중고 tab: productSearch without a keyword browses, newest first,
	// with the same filters and a HasNext flag.
	var browse struct {
		Products []product
		HasNext  bool
	}
	gql(t, newClient(), `query($c: String) { productSearch(ProductName: "", Category: $c) { HasNext Products { ProductId } } }`, map[string]interface{}{"c": "도서"}).field(t, "productSearch", &browse)
	if got := ids(browse.Products); len(got) < 2 || got[0] != newer.ProductId || !contains(got, older.ProductId) {
		t.Errorf("browse = %v, want the newest first and both products", got)
	}
	var cheap struct{ Products []product }
	gql(t, newClient(), `query($c: String) { productSearch(ProductName: "", Category: $c, MaxPrice: 15, Sort: "price_desc") { Products { ProductId } } }`, map[string]interface{}{"c": "도서"}).field(t, "productSearch", &cheap)
	if got := ids(cheap.Products); contains(got, newer.ProductId) || !contains(got, older.ProductId) {
		t.Errorf("browse with MaxPrice 15 = %v, want only the €10 product of the two", got)
	}

	var mine []product
	gql(t, newClient(), `query($u: String!) { userProducts(UserId: $u) { ProductId } }`, map[string]interface{}{"u": seller.ID}).field(t, "userProducts", &mine)
	if got := ids(mine); len(got) != 2 || got[0] != newer.ProductId || got[1] != older.ProductId {
		t.Errorf("userProducts = %v, want newest first, both", got)
	}

	var stats struct{ Products, Selling, Users float64 }
	gql(t, newClient(), `{ marketStats { Products Selling Users } }`, nil).field(t, "marketStats", &stats)
	if stats.Products < 2 || stats.Selling < 2 || stats.Selling > stats.Products {
		t.Errorf("marketStats = %+v", stats)
	}
}
