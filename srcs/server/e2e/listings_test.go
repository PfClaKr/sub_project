//go:build e2e

package e2e

import (
	"net/http"
	"testing"
	"time"
)

// One point for every listing: the apiserver caches its neighbourhood,
// so the suite asks OpenStreetMap once.
const testLat, testLng = 48.8414, 2.2920 // Paris 15e

type listing struct {
	PostId, Type, Title, Deal, AreaName, Status string
	HasContact                                  bool
	Housing                                     *struct {
		Mode, Kind    string
		Rent, Deposit float64
		Caf           bool
	}
	Job *struct {
		Mode, Sector, WageType string
		Wage                   float64
	}
}

const listingFields = `PostId Type Title Deal AreaName Status HasContact Housing { Mode Kind Rent Deposit Caf } Job { Mode Sector WageType Wage }`

type listingResult struct {
	Post     *listing
	Warnings []string
}

func housingInput(title, body string, rent float64, caf bool) map[string]interface{} {
	return map[string]interface{}{
		"Type": "housing", "Title": title, "Body": body, "Latitude": testLat, "Longitude": testLng,
		"Images": []string{}, // "seek" posts need no photo
		"Housing": map[string]interface{}{
			"Mode": "seek", "Kind": "쉐어", "Rent": rent, "Deposit": 1000, "Caf": caf,
			"AvailableFrom": time.Now().AddDate(0, 1, 0).Format("2006-01-02"),
		},
	}
}

func createListing(t *testing.T, u *user, input map[string]interface{}, ack bool) (listingResult, string) {
	t.Helper()
	r := gql(t, u.c, `mutation($in: ListingInput!, $ack: Boolean) { createListing(Input: $in, Acknowledge: $ack) { Warnings Post { `+listingFields+` } } }`,
		map[string]interface{}{"in": input, "ack": ack})
	var res listingResult
	if r.err() == "" {
		r.field(t, "createListing", &res)
		if res.Post != nil {
			id := res.Post.PostId
			t.Cleanup(func() {
				gql(t, u.c, `mutation($id: String!) { deletePost(PostId: $id) }`, map[string]interface{}{"id": id})
			})
		}
	}
	return res, r.err()
}

func listingIds(t *testing.T, vars map[string]interface{}) []string {
	t.Helper()
	var page struct{ Items []listing }
	gql(t, newClient(), `query($type: String!, $q: String, $h: HousingFilter, $j: JobFilter) {
		listings(Type: $type, Q: $q, Housing: $h, Job: $j) { Items { PostId } }
	}`, vars).field(t, "listings", &page)
	out := []string{}
	for _, l := range page.Items {
		out = append(out, l.PostId)
	}
	return out
}

func TestListingEligibility(t *testing.T) {
	newbie := signup(t, "newbie")
	if _, err := createListing(t, newbie, housingInput("e2e 신규 회원 "+runID, "방 구해요", 700, false), true); err != "가입 후 일주일이 지나야 집·알바 글을 쓸 수 있어요. 커뮤니티에서 먼저 활동해보세요." {
		t.Errorf("new account posting housing: %q", err)
	}
}

// Admins are exempt from the account-age rule, which lets the suite post.
func TestHousingListings(t *testing.T) {
	landlord := signup(t, "landlord")
	promoteAdmin(t, landlord.Email)
	other := signup(t, "tenant")

	risky := housingInput("e2e 15구 쉐어 "+runID, "카톡 abc123 으로 연락주세요. 보증금 먼저 보내주세요.", 640, true)
	res, err := createListing(t, landlord, risky, false)
	if err != "" || res.Post != nil || len(res.Warnings) != 2 {
		t.Fatalf("risky listing without acknowledge = %+v, %q; want warnings and nothing saved", res, err)
	}
	res, err = createListing(t, landlord, risky, true)
	if err != "" || res.Post == nil {
		t.Fatalf("acknowledged listing: %q", err)
	}
	h := res.Post
	if h.Deal != "open" || h.Housing == nil || h.Housing.Rent != 640 || h.AreaName == "" {
		t.Errorf("created listing = %+v", h)
	}

	if ids := listingIds(t, map[string]interface{}{"type": "housing", "h": map[string]interface{}{"Kinds": []string{"쉐어"}, "MaxRent": 700, "Caf": true}}); !contains(ids, h.PostId) {
		t.Error("listing missing from matching filters")
	}
	if ids := listingIds(t, map[string]interface{}{"type": "housing", "h": map[string]interface{}{"MaxRent": 600}}); contains(ids, h.PostId) {
		t.Error("listing above the max rent was returned")
	}
	if ids := listingIds(t, map[string]interface{}{"type": "job"}); contains(ids, h.PostId) {
		t.Error("housing listed among jobs")
	}
	if ids := listingIds(t, map[string]interface{}{"type": "housing", "q": "15구 쉐어 " + runID}); !contains(ids, h.PostId) {
		t.Error("keyword search misses the listing")
	}

	r := gql(t, other.c, `mutation($id: String!) { setListingDeal(PostId: $id, Deal: "closed") { Deal } }`, map[string]interface{}{"id": h.PostId})
	if r.err() != "내 글만 수정할 수 있어요." {
		t.Errorf("closing someone else's listing: %q", r.err())
	}

	// Contact goes through the site chat while the listing is open.
	if code := do(t, other.c, "GET", chatURL+"/room/housing/"+h.PostId, nil, nil); code != http.StatusCreated {
		t.Errorf("chat about an open listing = %d", code)
	}
	gql(t, landlord.c, `mutation($id: String!) { setListingDeal(PostId: $id, Deal: "closed") { Deal } }`, map[string]interface{}{"id": h.PostId})
	if ids := listingIds(t, map[string]interface{}{"type": "housing"}); contains(ids, h.PostId) {
		t.Error("closed listing still listed")
	}
	third := signup(t, "late-tenant")
	if code := do(t, third.c, "GET", chatURL+"/room/housing/"+h.PostId, nil, nil); code != http.StatusConflict {
		t.Errorf("new chat about a closed listing = %d, want 409", code)
	}

	if r := gql(t, landlord.c, `mutation($id: String!) { bumpListing(PostId: $id) { Deal } }`, map[string]interface{}{"id": h.PostId}); r.err() != "모집 중인 글만 끌어올릴 수 있어요." {
		t.Errorf("bumping a closed listing: %q", r.err())
	}
	gql(t, landlord.c, `mutation($id: String!) { setListingDeal(PostId: $id, Deal: "open") { Deal } }`, map[string]interface{}{"id": h.PostId})
	if r := gql(t, landlord.c, `mutation($id: String!) { bumpListing(PostId: $id) { Deal } }`, map[string]interface{}{"id": h.PostId}); r.err() != "끌어올리기는 하루에 한 번 할 수 있어요." {
		t.Errorf("bumping a new listing: %q", r.err())
	}
	if r := gql(t, landlord.c, `mutation($id: String!) { extendListing(PostId: $id) { Deal } }`, map[string]interface{}{"id": h.PostId}); r.err() != "만료 7일 전부터 연장할 수 있어요." {
		t.Errorf("extending a fresh listing: %q", r.err())
	}

	// Three open housing listings at most.
	for i := 2; i <= 3; i++ {
		if _, err := createListing(t, landlord, housingInput("e2e 추가 방 "+runID+string(rune('0'+i)), "두 번째 이후 방", 500, false), true); err != "" {
			t.Fatalf("listing %d: %s", i, err)
		}
	}
	if _, err := createListing(t, landlord, housingInput("e2e 네 번째 방 "+runID, "상한 초과", 500, false), true); err != "올릴 수 있는 글 수를 넘었어요. 끝난 글은 '완료'로 바꿔주세요." {
		t.Errorf("fourth open listing: %q", err)
	}

	// A housing post is not a community post and has no comments.
	var p *post
	gql(t, other.c, `query($id: String!) { post(PostId: $id) { PostId } }`, map[string]interface{}{"id": h.PostId}).field(t, "post", &p)
	if p != nil {
		t.Error("housing post served by the community query")
	}
}

func TestJobListings(t *testing.T) {
	boss := signup(t, "boss")
	promoteAdmin(t, boss.Email)
	seeker := signup(t, "seeker")
	input := map[string]interface{}{
		"Type": "job", "Title": "e2e 주말 홀서빙 " + runID, "Body": "11구 한식당입니다", "Latitude": testLat, "Longitude": testLng, "ExactLocation": true,
		"Job":     map[string]interface{}{"Mode": "hiring", "Sector": "식당·카페", "Employment": "알바", "WageType": "hourly", "Wage": 13.5, "PermitRequired": true},
		"Contact": map[string]interface{}{"Phone": "06 12 34 56 78"},
	}
	res, err := createListing(t, boss, input, false)
	if err != "" || res.Post == nil || !res.Post.HasContact {
		t.Fatalf("job listing = %+v, %q", res, err)
	}
	id := res.Post.PostId

	var detail map[string]interface{}
	gql(t, seeker.c, `query($id: String!) { listing(PostId: $id) { PostId HasContact } }`, map[string]interface{}{"id": id}).field(t, "listing", &detail)
	if detail["HasContact"] != true {
		t.Errorf("listing detail = %v", detail)
	}
	if r := gql(t, newClient(), `mutation($id: String!) { revealContact(PostId: $id) { Phone } }`, map[string]interface{}{"id": id}); r.err() != "로그인이 필요해요." {
		t.Errorf("anonymous contact reveal: %q", r.err())
	}
	var contact struct{ Phone string }
	gql(t, seeker.c, `mutation($id: String!) { revealContact(PostId: $id) { Phone } }`, map[string]interface{}{"id": id}).field(t, "revealContact", &contact)
	if contact.Phone != "06 12 34 56 78" {
		t.Errorf("revealed phone = %q", contact.Phone)
	}

	if ids := listingIds(t, map[string]interface{}{"type": "job", "j": map[string]interface{}{"MinWage": 13}}); !contains(ids, id) {
		t.Error("job missing from the minimum wage filter")
	}
	if ids := listingIds(t, map[string]interface{}{"type": "job", "j": map[string]interface{}{"PermitFree": true}}); contains(ids, id) {
		t.Error("job requiring a permit listed as permit-free")
	}
}
