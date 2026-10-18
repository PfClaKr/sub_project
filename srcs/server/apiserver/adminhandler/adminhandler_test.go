package adminhandler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"local.com/dynamo"
	"local.com/jwt"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/dynamodb/dynamodbiface"
	"github.com/gorilla/mux"
)

// fakeDB knows three users: "boss" and "deputy" (admins) and "member".
type fakeDB struct {
	dynamodbiface.DynamoDBAPI
	updates int
}

func (f *fakeDB) GetItem(in *dynamodb.GetItemInput) (*dynamodb.GetItemOutput, error) {
	if *in.TableName == dynamo.TableUsers {
		switch *in.Key["UserId"].S {
		case "boss":
			return &dynamodb.GetItemOutput{Item: dynamo.Item{"UserId": {S: aws.String("boss")}, "Role": {S: aws.String("admin")}}}, nil
		case "deputy":
			return &dynamodb.GetItemOutput{Item: dynamo.Item{"UserId": {S: aws.String("deputy")}, "Role": {S: aws.String("admin")}}}, nil
		case "member":
			return &dynamodb.GetItemOutput{Item: dynamo.Item{"UserId": {S: aws.String("member")}}}, nil
		}
	}
	return &dynamodb.GetItemOutput{}, nil
}

func (f *fakeDB) UpdateItem(*dynamodb.UpdateItemInput) (*dynamodb.UpdateItemOutput, error) {
	f.updates++
	return &dynamodb.UpdateItemOutput{}, nil
}

func (f *fakeDB) ScanPages(in *dynamodb.ScanInput, fn func(*dynamodb.ScanOutput, bool) bool) error {
	fn(&dynamodb.ScanOutput{}, true)
	return nil
}

func serve(t *testing.T, user, method, path, body string) (*httptest.ResponseRecorder, *fakeDB) {
	t.Helper()
	fake := &fakeDB{}
	orig := svc
	svc = fake
	t.Cleanup(func() { svc = orig })

	r := mux.NewRouter()
	Register(r)
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if user != "" {
		token, _ := jwt.New(user)
		req.AddCookie(&http.Cookie{Name: "token", Value: token})
	}
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr, fake
}

func TestAdminRoutesRequireAdminRole(t *testing.T) {
	for _, path := range []string{"/admin/stats", "/admin/users", "/admin/products", "/admin/conversations", "/admin/reports", "/admin/posts"} {
		if rr, _ := serve(t, "", "GET", path, ""); rr.Code != http.StatusUnauthorized {
			t.Errorf("anonymous %s = %d, want 401", path, rr.Code)
		}
		if rr, _ := serve(t, "member", "GET", path, ""); rr.Code != http.StatusForbidden {
			t.Errorf("member %s = %d, want 403", path, rr.Code)
		}
		if rr, _ := serve(t, "boss", "GET", path, ""); rr.Code != http.StatusOK {
			t.Errorf("admin %s = %d, want 200: %s", path, rr.Code, rr.Body)
		}
	}
}

func TestAdminCannotChangeOwnRole(t *testing.T) {
	rr, fake := serve(t, "boss", "PATCH", "/admin/users/boss", `{"Role":"user"}`)
	if rr.Code != http.StatusBadRequest || fake.updates != 0 {
		t.Errorf("self demotion: status %d, updates %d", rr.Code, fake.updates)
	}
	rr, fake = serve(t, "boss", "PATCH", "/admin/users/member", `{"Role":"superuser"}`)
	if rr.Code != http.StatusBadRequest || fake.updates != 0 {
		t.Errorf("unknown role: status %d, updates %d", rr.Code, fake.updates)
	}
	rr, fake = serve(t, "boss", "PATCH", "/admin/users/member", `{"Role":"admin"}`)
	if rr.Code != http.StatusOK || fake.updates != 1 {
		t.Errorf("promotion: status %d, updates %d", rr.Code, fake.updates)
	}
}

func TestDeleteRefusesSelfAndAdmins(t *testing.T) {
	if rr, _ := serve(t, "boss", "DELETE", "/admin/users/boss", ""); rr.Code != http.StatusBadRequest {
		t.Errorf("self delete = %d, want 400", rr.Code)
	}
	if rr, _ := serve(t, "boss", "DELETE", "/admin/users/deputy", ""); rr.Code != http.StatusBadRequest {
		t.Errorf("deleting another admin = %d, want 400", rr.Code)
	}
	if rr, _ := serve(t, "boss", "DELETE", "/admin/users/nobody", ""); rr.Code != http.StatusNotFound {
		t.Errorf("unknown user delete = %d, want 404", rr.Code)
	}
}

func TestPaginate(t *testing.T) {
	cases := []struct {
		total                        int
		raw                          string
		page, totalPages, start, end int
	}{
		{0, "", 1, 1, 0, 0},
		{45, "2", 2, 3, 20, 40},
		{45, "99", 3, 3, 40, 45}, // clamped to the last page
		{45, "-1", 1, 3, 0, 20},
	}
	for _, c := range cases {
		page, tp, s, e := paginate(c.total, c.raw)
		if page != c.page || tp != c.totalPages || s != c.start || e != c.end {
			t.Errorf("paginate(%d,%q) = %d,%d,%d,%d", c.total, c.raw, page, tp, s, e)
		}
	}
}

func TestSuspension(t *testing.T) {
	if rr, _ := serve(t, "member", "PUT", "/admin/users/member/suspension", `{"Days":7}`); rr.Code != http.StatusForbidden {
		t.Errorf("member suspending = %d, want 403", rr.Code)
	}
	if rr, fake := serve(t, "boss", "PUT", "/admin/users/boss/suspension", `{"Days":7}`); rr.Code != http.StatusBadRequest || fake.updates != 0 {
		t.Errorf("self suspension = %d (updates %d), want 400", rr.Code, fake.updates)
	}
	if rr, fake := serve(t, "boss", "PUT", "/admin/users/deputy/suspension", `{"Days":7}`); rr.Code != http.StatusBadRequest || fake.updates != 0 {
		t.Errorf("suspending an admin = %d (updates %d), want 400", rr.Code, fake.updates)
	}
	if rr, _ := serve(t, "boss", "PUT", "/admin/users/nobody/suspension", `{"Days":7}`); rr.Code != http.StatusNotFound {
		t.Errorf("unknown user = %d, want 404", rr.Code)
	}
	if rr, _ := serve(t, "boss", "PUT", "/admin/users/member/suspension", `{"Days":-1}`); rr.Code != http.StatusBadRequest {
		t.Errorf("negative days = %d, want 400", rr.Code)
	}
	if rr, fake := serve(t, "boss", "PUT", "/admin/users/member/suspension", `{"Days":7}`); rr.Code != http.StatusOK || fake.updates != 1 {
		t.Errorf("suspension = %d (updates %d), want 200 and one write: %s", rr.Code, fake.updates, rr.Body)
	}
	if rr, fake := serve(t, "boss", "DELETE", "/admin/users/member/suspension", ""); rr.Code != http.StatusOK || fake.updates != 1 {
		t.Errorf("reinstate = %d (updates %d)", rr.Code, fake.updates)
	}
}

func TestResolveRejectsUnknownActions(t *testing.T) {
	if rr, _ := serve(t, "boss", "POST", "/admin/reports/resolve", `{"TargetType":"post","TargetId":"p1","Action":"nuke"}`); rr.Code != http.StatusBadRequest {
		t.Errorf("unknown action = %d, want 400", rr.Code)
	}
	if rr, _ := serve(t, "member", "POST", "/admin/reports/resolve", `{"TargetType":"post","TargetId":"p1","Action":"hide"}`); rr.Code != http.StatusForbidden {
		t.Errorf("member resolving = %d, want 403", rr.Code)
	}
	if rr, _ := serve(t, "boss", "PATCH", "/admin/posts/p1", `{"Status":"weird"}`); rr.Code != http.StatusBadRequest {
		t.Errorf("unknown post status = %d, want 400", rr.Code)
	}
}

// Closing reports as handled leaves the target alone for every type, so it
// also works for a post or comment its author already deleted.
func TestResolveNeverTouchesTheTarget(t *testing.T) {
	for _, typ := range []string{"post", "comment", "product", "user", "chat"} {
		if err := applyAction(typ, "gone#c1", ActionResolve); err != nil {
			t.Errorf("resolve on %s: %v", typ, err)
		}
	}
	if err := applyAction("user", "u1", ActionHide); err == nil {
		t.Error("hide on a member should be refused")
	}
}
