package graphqlhandler

import (
	"context"
	"strings"
	"testing"

	"apiserver/geohandler"
	"apiserver/uploadhandler"

	"local.com/dynamo"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/graphql-go/graphql"
)

// fakeDB serves one product owned by "owner" and records writes.
type fakeDB struct {
	dynamodbiface.DynamoDBAPI
	writes int
}

func (f *fakeDB) GetItem(in *dynamodb.GetItemInput) (*dynamodb.GetItemOutput, error) {
	if *in.TableName == dynamo.TableProduct && *in.Key["ProductId"].S == "p1" {
		return &dynamodb.GetItemOutput{Item: dynamo.Item{
			"ProductId": {S: aws.String("p1")},
			"UserId":    {S: aws.String("owner")},
		}}, nil
	}
	return &dynamodb.GetItemOutput{}, nil
}

func (f *fakeDB) UpdateItem(*dynamodb.UpdateItemInput) (*dynamodb.UpdateItemOutput, error) {
	f.writes++
	return &dynamodb.UpdateItemOutput{}, nil
}

func (f *fakeDB) DeleteItem(*dynamodb.DeleteItemInput) (*dynamodb.DeleteItemOutput, error) {
	f.writes++
	return &dynamodb.DeleteItemOutput{}, nil
}

func run(t *testing.T, userId, query string) *graphql.Result {
	t.Helper()
	ctx := context.Background()
	if userId != "" {
		ctx = jwt.WithClaims(ctx, &jwt.Claims{Username: userId})
	}
	return graphql.Do(graphql.Params{Schema: schema, RequestString: query, Context: ctx})
}

func withFake(t *testing.T) *fakeDB {
	fake := &fakeDB{}
	orig := svc
	svc = fake
	t.Cleanup(func() { svc = orig })
	return fake
}

func TestEveryRootFieldHasResolver(t *testing.T) {
	for _, root := range []*graphql.Object{schema.QueryType(), schema.MutationType()} {
		for name := range root.Fields() {
			if _, ok := resolvers[root.Name()+"."+name]; !ok {
				t.Errorf("%s.%s has no resolver", root.Name(), name)
			}
		}
	}
}

func TestUserTypeHidesCredentials(t *testing.T) {
	fields := schema.Type("User").(*graphql.Object).Fields()
	for _, f := range []string{"Email", "PasswordHash"} {
		if _, ok := fields[f]; ok {
			t.Errorf("User.%s must not be exposed", f)
		}
	}
}

func TestMutationsRequireOwnership(t *testing.T) {
	mutations := []string{
		`mutation { deleteProduct(ProductId: "p1") }`,
		`mutation { updateProductStatus(ProductId: "p1", ProductStatus: "예약중") { ProductStatus } }`,
	}
	for _, m := range mutations {
		fake := withFake(t)

		res := run(t, "", m)
		if len(res.Errors) == 0 || res.Errors[0].Message != errLogin.Error() {
			t.Errorf("anonymous %q: errors = %v, want login error", m, res.Errors)
		}

		res = run(t, "intruder", m)
		if len(res.Errors) == 0 || res.Errors[0].Message != errForbidden.Error() {
			t.Errorf("non-owner %q: errors = %v, want forbidden", m, res.Errors)
		}

		if fake.writes != 0 {
			t.Errorf("%q wrote %d times without permission", m, fake.writes)
		}
	}

	withFake(t)
	res := run(t, "owner", `mutation { updateProductStatus(ProductId: "p1", ProductStatus: "예약중") { ProductStatus } }`)
	if len(res.Errors) != 0 {
		t.Fatalf("owner update failed: %v", res.Errors)
	}
}

func TestParseProductInput(t *testing.T) {
	valid := func() map[string]interface{} {
		return map[string]interface{}{
			"ProductName":        "책상",
			"ProductDescription": "튼튼해요",
			"ProductPrice":       30.0,
			"ProductCategory":    "가구",
			"PreferedLocation":   "Paris 15e",
			"ProductImage":       []interface{}{uploadhandler.PublicBase() + "/a.jpg"},
		}
	}
	if _, err := parseProductInput(valid()); err != nil {
		t.Fatalf("valid input rejected: %v", err)
	}

	bad := map[string]func(map[string]interface{}){
		"empty name":       func(a map[string]interface{}) { a["ProductName"] = "  " },
		"negative price":   func(a map[string]interface{}) { a["ProductPrice"] = -1.0 },
		"bad category":     func(a map[string]interface{}) { a["ProductCategory"] = "무기" },
		"foreign image":    func(a map[string]interface{}) { a["ProductImage"] = []interface{}{"https://evil.example/x.png"} },
		"long desc":        func(a map[string]interface{}) { a["ProductDescription"] = strings.Repeat("가", 2001) },
		"missing location": func(a map[string]interface{}) { a["PreferedLocation"] = "" },
		"unknown region":   func(a map[string]interface{}) { a["ProductRegion"] = "서울" },
	}
	legacy := valid()
	legacy["ProductImage"] = []interface{}{"https://old.example/a.png"}
	if _, err := parseProductInput(legacy, "https://old.example/a.png"); err != nil {
		t.Errorf("image already on the product must be kept: %v", err)
	}

	for name, mutate := range bad {
		args := valid()
		mutate(args)
		if _, err := parseProductInput(args); err == nil {
			t.Errorf("%s: want error", name)
		}
	}
}

func TestParseGeo(t *testing.T) {
	cases := []struct {
		name  string
		args  map[string]interface{}
		ok    bool
		isNil bool
	}{
		{"no position", map[string]interface{}{}, true, true},
		{"exact pin", map[string]interface{}{"Latitude": 48.85, "Longitude": 2.35, "ExactLocation": true}, true, false},
		{"area", map[string]interface{}{"Latitude": 48.85, "Longitude": 2.35}, true, false},
		{"latitude only", map[string]interface{}{"Latitude": 48.85}, false, true},
		{"out of range", map[string]interface{}{"Latitude": 95.0, "Longitude": 2.35}, false, true},
	}
	for _, c := range cases {
		geo, err := parseGeo(c.args)
		if (err == nil) != c.ok || (geo == nil) != c.isNil {
			t.Errorf("%s: geo=%v err=%v", c.name, geo, err)
		}
	}
}

// Area mode must never store the picked point, only the area centre.
func TestLocateHidesPointInAreaMode(t *testing.T) {
	orig := resolveArea
	t.Cleanup(func() { resolveArea = orig })
	resolveArea = func(lat, lng float64) (*geohandler.Area, error) {
		return &geohandler.Area{AreaId: "R9520", Name: "Paris 15e", Postcode: "75015", CenterLat: 48.84, CenterLng: 2.29}, nil
	}

	area, err := locate(&geoInput{Lat: 48.8412345, Lng: 2.3012345})
	if err != nil {
		t.Fatal(err)
	}
	if *area["Latitude"].N != "48.84" || *area["Longitude"].N != "2.29" || *area["ExactLocation"].BOOL {
		t.Errorf("area mode stored %v,%v exact=%v", *area["Latitude"].N, *area["Longitude"].N, *area["ExactLocation"].BOOL)
	}
	if *area["AreaName"].S != "Paris 15e (75015)" {
		t.Errorf("AreaName = %q", *area["AreaName"].S)
	}

	pin, _ := locate(&geoInput{Lat: 48.8412345, Lng: 2.3012345, Exact: true})
	if *pin["Latitude"].N != "48.8412345" {
		t.Errorf("exact pin must keep the point: %v", *pin["Latitude"].N)
	}

	resolveArea = func(lat, lng float64) (*geohandler.Area, error) { return nil, geohandler.ErrNoArea }
	if _, err := locate(&geoInput{Lat: 1, Lng: 1}); err == nil {
		t.Error("area mode without an area must fail")
	}
	if pin, err := locate(&geoInput{Lat: 1, Lng: 1, Exact: true}); err != nil || pin["AreaId"] != nil {
		t.Errorf("exact pin without an area must still save: %v %v", pin, err)
	}
}
