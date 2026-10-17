package graphqlhandler

import (
	"strings"
	"testing"
	"time"

	"apiserver/uploadhandler"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

func housingArgs(mode, kind string, images int, extra map[string]interface{}) map[string]interface{} {
	h := map[string]interface{}{"Mode": mode, "Kind": kind, "Rent": 750.0, "AvailableFrom": time.Now().Format(dateLayout)}
	for k, v := range extra {
		h[k] = v
	}
	imgs := []interface{}{}
	for i := 0; i < images; i++ {
		imgs = append(imgs, uploadhandler.PublicBase()+"/room.jpg")
	}
	return map[string]interface{}{
		"Type": "housing", "Title": "15구 쉐어 방", "Body": "채광 좋은 방이에요",
		"Latitude": 48.84, "Longitude": 2.29, "ExactLocation": true, "Images": imgs, "Housing": h,
	}
}

func TestParseHousing(t *testing.T) {
	in, err := parseListingInput(housingArgs("offer", "쉐어", 1, nil))
	if err != nil {
		t.Fatal(err)
	}
	if in.Geo.Exact {
		t.Error("housing must never keep the exact point")
	}
	if in.Topic != "쉐어" || dynamo.S(in.Fields, "Mode") != "offer" {
		t.Errorf("topic %q fields %v", in.Topic, in.Fields)
	}
	if _, err := parseListingInput(housingArgs("seek", "쉐어", 0, nil)); err != nil {
		t.Errorf("a 'seek' post needs no photo: %v", err)
	}

	bad := map[string]map[string]interface{}{
		"offer without photo": housingArgs("offer", "쉐어", 0, nil),
		"unknown kind":        housingArgs("offer", "성", 1, nil),
		"sublet without end":  housingArgs("offer", "서블렛", 1, nil),
		"end before start":    housingArgs("offer", "쉐어", 1, map[string]interface{}{"EndDate": "2000-01-01"}),
		"negative rent":       housingArgs("offer", "쉐어", 1, map[string]interface{}{"Rent": -1.0}),
		"bad date":            housingArgs("offer", "쉐어", 1, map[string]interface{}{"AvailableFrom": "next week"}),
	}
	for name, args := range bad {
		if _, err := parseListingInput(args); err == nil {
			t.Errorf("%s accepted", name)
		}
	}
	noMap := housingArgs("offer", "쉐어", 1, nil)
	delete(noMap, "Latitude")
	delete(noMap, "Longitude")
	if _, err := parseListingInput(noMap); err == nil {
		t.Error("a listing without a map position was accepted")
	}
}

func jobArgs(mode string, wage float64, contact map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"Type": "job", "Title": "주말 홀서빙 구해요", "Body": "11구 한식당입니다",
		"Latitude": 48.86, "Longitude": 2.38, "ExactLocation": true,
		"Job": map[string]interface{}{
			"Mode": mode, "Sector": "식당·카페", "Employment": "알바", "WageType": "hourly", "Wage": wage,
			"Languages": []interface{}{"한국어", "클링온어", "한국어"},
		},
		"Contact": contact,
	}
}

func TestParseJob(t *testing.T) {
	t.Setenv("SMIC_HOURLY", "12")
	in, err := parseListingInput(jobArgs("hiring", 10, map[string]interface{}{"Phone": "06 12 34 56 78"}))
	if err != nil {
		t.Fatal(err)
	}
	if !contains(in.Warnings, RiskLowWage) {
		t.Errorf("hourly wage below the minimum must warn: %v", in.Warnings)
	}
	if !in.Geo.Exact {
		t.Error("a job may show the exact place")
	}
	if dynamo.S(in.Contact, "Phone") == "" {
		t.Error("employer contact dropped")
	}
	if got := listOf(in.Fields["Languages"]); strings.Join(got, ",") != "한국어" {
		t.Errorf("languages = %v, want only known ones, once", got)
	}

	seeker, err := parseListingInput(jobArgs("seeking", 10, map[string]interface{}{"Phone": "06 12 34 56 78"}))
	if err != nil {
		t.Fatal(err)
	}
	if seeker.Contact != nil || contains(seeker.Warnings, RiskLowWage) {
		t.Errorf("job seekers get no contact field and no wage warning: %+v", seeker)
	}
	if _, err := parseListingInput(jobArgs("hiring", 15, map[string]interface{}{"Phone": "call me"})); err == nil {
		t.Error("invalid phone accepted")
	}
}

// expiryDB serves three active listings and records the writes.
type expiryDB struct {
	fakeDB
	statusWrites, notices, notifications int
}

func (f *expiryDB) ScanPages(in *dynamodb.ScanInput, fn func(*dynamodb.ScanOutput, bool) bool) error {
	now := time.Now()
	listing := func(id string, expires time.Time, notified bool) dynamo.Item {
		return dynamo.Item{
			"PostId": {S: aws.String(id)}, "Type": {S: aws.String("housing")}, "AuthorId": {S: aws.String("a")},
			"Status": {S: aws.String(PostActive)}, "Deal": {S: aws.String(DealOpen)},
			"ExpiresAt":      {N: aws.String(itoa(expires.UnixMilli()))},
			"ExpiryNotified": {BOOL: aws.Bool(notified)},
		}
	}
	fn(&dynamodb.ScanOutput{Items: []dynamo.Item{
		listing("expired", now.Add(-time.Hour), true),
		listing("soon", now.Add(48*time.Hour), false),
		listing("soon-notified", now.Add(48*time.Hour), true),
		listing("later", now.Add(20*24*time.Hour), false),
	}}, true)
	return nil
}

func (f *expiryDB) UpdateItem(in *dynamodb.UpdateItemInput) (*dynamodb.UpdateItemOutput, error) {
	switch expr := *in.UpdateExpression; {
	case strings.HasPrefix(expr, "SET #s"):
		f.statusWrites++
	case strings.HasPrefix(expr, "SET ExpiryNotified"):
		f.notices++
	}
	return &dynamodb.UpdateItemOutput{}, nil
}

func (f *expiryDB) PutItem(*dynamodb.PutItemInput) (*dynamodb.PutItemOutput, error) {
	f.notifications++
	return &dynamodb.PutItemOutput{}, nil
}

func TestExpireListings(t *testing.T) {
	fake := &expiryDB{}
	orig := svc
	svc = fake
	t.Cleanup(func() { svc = orig })

	if err := ExpireListings(time.Now()); err != nil {
		t.Fatal(err)
	}
	if fake.statusWrites != 1 || fake.notices != 1 || fake.notifications != 1 {
		t.Errorf("status writes %d, notices %d, notifications %d; want 1, 1, 1", fake.statusWrites, fake.notices, fake.notifications)
	}
}
