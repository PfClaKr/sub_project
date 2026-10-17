//go:build e2e

package e2e

import (
	"net/http"
	"testing"
)

type queueItem struct {
	TargetType, TargetId, TargetStatus, OwnerId, Title string
	Count, Counted                                     int
	Reasons                                            map[string]int
}

func reportPost(t *testing.T, u *user, postId string) {
	t.Helper()
	if err := gql(t, u.c, `mutation($id: String!) { report(TargetType: "post", TargetId: $id, Reason: "사기 의심", Detail: "선입금 요구") }`,
		map[string]interface{}{"id": postId}).err(); err != "" {
		t.Fatalf("report: %s", err)
	}
}

// Reports from established accounts hide a post at three; reports from
// brand-new accounts are queued but not counted. Admins count as
// established, which lets the suite build the three.
func TestModeration(t *testing.T) {
	author := signup(t, "mod-author")
	newbie := signup(t, "mod-newbie")
	mods := []*user{signup(t, "mod-a"), signup(t, "mod-b"), signup(t, "mod-c")}
	for _, m := range mods {
		promoteAdmin(t, m.Email)
	}
	p := newPost(t, author, "free", "일상", "e2e 신고 대상 "+runID, false)

	reportPost(t, newbie, p.PostId)
	reportPost(t, mods[0], p.PostId)
	reportPost(t, mods[1], p.PostId)
	if got := getPost(t, newbie, p.PostId); got == nil {
		t.Fatal("hidden after two counted reports (the newcomer's must not count)")
	}
	reportPost(t, mods[2], p.PostId)
	if got := getPost(t, newbie, p.PostId); got != nil {
		t.Error("post still visible after three counted reports")
	}
	if got := getPost(t, author, p.PostId); got == nil || got.Status != "hidden" {
		t.Errorf("the author must still see the hidden post: %+v", got)
	}
	if n := notificationTypes(t, author); count(n, "hidden") != 1 {
		t.Errorf("author notifications = %v, want hidden", n)
	}
	if ids := listPostIds(t, map[string]interface{}{"type": "free"}); contains(ids, p.PostId) {
		t.Error("hidden post still listed")
	}

	admin := mods[0]
	var queue struct {
		Items []queueItem
		Total int
	}
	do(t, admin.c, "GET", apiURL+"/admin/reports?type=post", nil, &queue)
	var item *queueItem
	for i := range queue.Items {
		if queue.Items[i].TargetId == p.PostId {
			item = &queue.Items[i]
		}
	}
	if item == nil || item.Count != 4 || item.Counted != 3 || item.TargetStatus != "hidden" || item.OwnerId != author.ID || item.Reasons["사기 의심"] != 4 {
		t.Fatalf("queue entry = %+v", item)
	}

	if code := do(t, newbie.c, "POST", apiURL+"/admin/reports/resolve", map[string]string{"TargetType": "post", "TargetId": p.PostId, "Action": "dismiss"}, nil); code != http.StatusForbidden {
		t.Errorf("member resolving = %d, want 403", code)
	}
	var res struct{ Closed int }
	if code := do(t, admin.c, "POST", apiURL+"/admin/reports/resolve", map[string]string{"TargetType": "post", "TargetId": p.PostId, "Action": "dismiss"}, &res); code != http.StatusOK || res.Closed != 4 {
		t.Fatalf("dismiss = %d, closed %d", code, res.Closed)
	}
	if got := getPost(t, newbie, p.PostId); got == nil {
		t.Error("dismissed post not restored")
	}
	if n := notificationTypes(t, author); count(n, "restored") != 1 {
		t.Errorf("author notifications = %v, want restored", n)
	}
	do(t, admin.c, "GET", apiURL+"/admin/reports?type=post", nil, &queue)
	for _, q := range queue.Items {
		if q.TargetId == p.PostId {
			t.Error("dismissed reports still in the open queue")
		}
	}

	// Comments: an admin hides one from the queue directly.
	c := addComment(t, author, p.PostId, "신고될 댓글", "", false)
	if err := gql(t, newbie.c, `mutation($id: String!) { report(TargetType: "comment", TargetId: $id, Reason: "욕설·혐오") }`,
		map[string]interface{}{"id": p.PostId + "#" + c.CommentId}).err(); err != "" {
		t.Fatalf("comment report: %s", err)
	}
	if code := do(t, admin.c, "POST", apiURL+"/admin/reports/resolve", map[string]string{"TargetType": "comment", "TargetId": p.PostId + "#" + c.CommentId, "Action": "hide"}, nil); code != http.StatusOK {
		t.Fatalf("hide comment = %d", code)
	}
	var thread []comment
	gql(t, newClient(), `query($p: String!) { comments(PostId: $p) { CommentId } }`, map[string]interface{}{"p": p.PostId}).field(t, "comments", &thread)
	for _, tc := range thread {
		if tc.CommentId == c.CommentId {
			t.Error("hidden comment still in the thread")
		}
	}

	// The post list shows the real author of anonymous posts.
	anon := newPost(t, author, "qna", "기타", "e2e 익명 작성자 확인 "+runID, true)
	var posts struct {
		Items []struct {
			PostId, AuthorId string
			Anonymous        bool
		}
	}
	do(t, admin.c, "GET", apiURL+"/admin/posts?q="+q("e2e 익명 작성자 확인 "+runID), nil, &posts)
	if len(posts.Items) != 1 || posts.Items[0].PostId != anon.PostId || posts.Items[0].AuthorId != author.ID || !posts.Items[0].Anonymous {
		t.Errorf("admin post list = %+v", posts.Items)
	}
	if code := do(t, admin.c, "PATCH", apiURL+"/admin/posts/"+anon.PostId, map[string]string{"Status": "hidden"}, nil); code != http.StatusOK {
		t.Errorf("admin hide = %d", code)
	}
	if got := getPost(t, newbie, anon.PostId); got != nil {
		t.Error("post hidden by an admin is still visible")
	}
}
