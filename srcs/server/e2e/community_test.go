//go:build e2e

package e2e

import (
	"testing"
)

type post struct {
	PostId, Type, Topic, City, Title, Body, AuthorId, AuthorNickname, Status, AcceptedCommentId string
	Anonymous, IsMine, Solved, Liked, Bookmarked                                                bool
	LikeCount, CommentCount, ViewCount                                                          float64
}

type comment struct {
	CommentId, ParentId, Body, DisplayName, AuthorId   string
	Anonymous, IsMine, IsPostAuthor, Deleted, Accepted bool
}

const postFields = `PostId Type Topic City Title Body AuthorId AuthorNickname Status AcceptedCommentId Anonymous IsMine Solved Liked Bookmarked LikeCount CommentCount ViewCount`

func newPost(t *testing.T, u *user, typ, topic, title string, anonymous bool) post {
	t.Helper()
	r := gql(t, u.c, `mutation($in: PostInput!) { createPost(Input: $in) { `+postFields+` } }`, map[string]interface{}{
		"in": map[string]interface{}{"Type": typ, "Topic": topic, "Title": title, "Body": "e2e 본문 " + title, "Anonymous": anonymous},
	})
	var p post
	r.field(t, "createPost", &p)
	if p.PostId == "" {
		t.Fatalf("createPost %q: %s", title, r.err())
	}
	t.Cleanup(func() {
		gql(t, u.c, `mutation($id: String!) { deletePost(PostId: $id) }`, map[string]interface{}{"id": p.PostId})
	})
	return p
}

func getPost(t *testing.T, u *user, id string) *post {
	t.Helper()
	var p *post
	gql(t, u.c, `query($id: String!) { post(PostId: $id) { `+postFields+` } }`, map[string]interface{}{"id": id}).field(t, "post", &p)
	return p
}

func listPostIds(t *testing.T, vars map[string]interface{}) []string {
	t.Helper()
	var page struct {
		Items []post
		Total int
	}
	r := gql(t, newClient(), `query($type: String, $q: String, $topic: String, $solved: Boolean) {
		posts(Type: $type, Q: $q, Topic: $topic, Solved: $solved) { Items { PostId } Total }
	}`, vars)
	r.field(t, "posts", &page)
	out := []string{}
	for _, p := range page.Items {
		out = append(out, p.PostId)
	}
	return out
}

func addComment(t *testing.T, u *user, postId, body, parent string, anonymous bool) comment {
	t.Helper()
	vars := map[string]interface{}{"p": postId, "b": body, "a": anonymous}
	if parent != "" {
		vars["parent"] = parent
	}
	r := gql(t, u.c, `mutation($p: String!, $b: String!, $parent: String, $a: Boolean) {
		createComment(PostId: $p, Body: $b, ParentId: $parent, Anonymous: $a) { CommentId ParentId DisplayName AuthorId Anonymous IsPostAuthor }
	}`, vars)
	var c comment
	r.field(t, "createComment", &c)
	if c.CommentId == "" {
		t.Fatalf("createComment: %s", r.err())
	}
	return c
}

func notificationTypes(t *testing.T, u *user) []string {
	t.Helper()
	var page struct{ Items []struct{ Type, Link string } }
	gql(t, u.c, `{ notifications { Items { Type Link } } }`, nil).field(t, "notifications", &page)
	out := []string{}
	for _, n := range page.Items {
		out = append(out, n.Type)
	}
	return out
}

func count(list []string, s string) int {
	n := 0
	for _, v := range list {
		if v == s {
			n++
		}
	}
	return n
}

func TestCommunityPosts(t *testing.T) {
	author := signup(t, "post-author")
	reader := signup(t, "post-reader")
	title := "e2e 체류증 갱신 서류 " + runID
	p := newPost(t, author, "qna", "체류증·비자", title, true)

	if !p.IsMine || p.AuthorNickname != "익명" || p.City != "파리" || p.Status != "active" {
		t.Errorf("created post = %+v", p)
	}
	seen := getPost(t, reader, p.PostId)
	if seen == nil || seen.AuthorId != "" || seen.IsMine || seen.AuthorNickname != "익명" {
		t.Errorf("anonymous post as seen by others = %+v", seen)
	}

	if ids := listPostIds(t, map[string]interface{}{"type": "qna", "topic": "체류증·비자"}); !contains(ids, p.PostId) {
		t.Error("new question missing from its board")
	}
	if ids := listPostIds(t, map[string]interface{}{"type": "free"}); contains(ids, p.PostId) {
		t.Error("question listed on the free board")
	}
	if ids := listPostIds(t, map[string]interface{}{"q": "체류증 갱신 " + runID}); !contains(ids, p.PostId) {
		t.Error("keyword search misses the post")
	}
	if ids := listPostIds(t, map[string]interface{}{"type": "qna", "solved": true}); contains(ids, p.PostId) {
		t.Error("open question listed as solved")
	}

	var similar []post
	gql(t, reader.c, `query($t: String!) { similarQuestions(Title: $t) { PostId } }`, map[string]interface{}{"t": "체류증 갱신 서류 " + runID}).field(t, "similarQuestions", &similar)
	found := false
	for _, s := range similar {
		found = found || s.PostId == p.PostId
	}
	if !found {
		t.Error("similarQuestions misses an obvious match")
	}

	r := gql(t, reader.c, `mutation($id: String!, $in: PostInput!) { updatePost(PostId: $id, Input: $in) { PostId } }`, map[string]interface{}{
		"id": p.PostId, "in": map[string]interface{}{"Type": "qna", "Topic": "기타", "Title": "남의 글 수정", "Body": "x"},
	})
	if r.err() != "내 글만 수정할 수 있어요." {
		t.Errorf("editing someone else's post: %q", r.err())
	}

	// The same post twice within a day is refused.
	r = gql(t, author.c, `mutation($in: PostInput!) { createPost(Input: $in) { PostId } }`, map[string]interface{}{
		"in": map[string]interface{}{"Type": "qna", "Topic": "체류증·비자", "Title": title, "Body": "e2e 본문 " + title},
	})
	if r.err() != "같은 글을 이미 올렸어요." {
		t.Errorf("duplicate post: %q", r.err())
	}

	gql(t, author.c, `mutation($id: String!) { deletePost(PostId: $id) }`, map[string]interface{}{"id": p.PostId})
	if getPost(t, reader, p.PostId) != nil {
		t.Error("deleted post still readable")
	}
	if ids := listPostIds(t, map[string]interface{}{"type": "qna"}); contains(ids, p.PostId) {
		t.Error("deleted post still listed")
	}
}

func TestCommentsAndAcceptedAnswer(t *testing.T) {
	asker := signup(t, "asker")
	alice := signup(t, "alice")
	bob := signup(t, "bob")
	p := newPost(t, asker, "qna", "은행·통신", "e2e 은행 계좌 개설 "+runID, true)

	a1 := addComment(t, alice, p.PostId, "BNP 추천해요", "", true)
	b1 := addComment(t, bob, p.PostId, "온라인 은행도 있어요", "", true)
	a2 := addComment(t, alice, p.PostId, "추가로 하나 더", "", true)
	mine := addComment(t, asker, p.PostId, "감사합니다", a1.CommentId, false)
	if a1.DisplayName != "익명1" || b1.DisplayName != "익명2" || a2.DisplayName != "익명1" {
		t.Errorf("anonymous numbering = %s, %s, %s", a1.DisplayName, b1.DisplayName, a2.DisplayName)
	}
	if mine.DisplayName != "익명(글쓴이)" || !mine.IsPostAuthor || mine.ParentId != a1.CommentId {
		t.Errorf("author's reply on an anonymous post = %+v", mine)
	}
	if a1.AuthorId != "" {
		t.Error("anonymous comment leaks its author id")
	}
	// A reply to a reply hangs under the top-level comment.
	nested := addComment(t, bob, p.PostId, "저도요", mine.CommentId, false)
	if nested.ParentId != a1.CommentId {
		t.Errorf("nested reply parent = %s, want %s", nested.ParentId, a1.CommentId)
	}

	if got := getPost(t, asker, p.PostId); got.CommentCount != 5 {
		t.Errorf("CommentCount = %v, want 5", got.CommentCount)
	}
	// Three comments from others; bob's answer to the asker's own reply is
	// a reply to the asker (one notification, not two); the asker's own
	// reply notifies nobody but alice.
	if n := notificationTypes(t, asker); count(n, "comment") != 3 || count(n, "reply") != 1 {
		t.Errorf("asker notifications = %v, want 3 comments and 1 reply", n)
	}
	if n := notificationTypes(t, alice); count(n, "reply") != 1 {
		t.Errorf("alice notifications = %v, want the asker's reply", n)
	}

	r := gql(t, bob.c, `mutation($p: String!, $c: String!) { acceptAnswer(PostId: $p, CommentId: $c) { Solved } }`, map[string]interface{}{"p": p.PostId, "c": a1.CommentId})
	if r.err() != "질문한 사람만 답변을 채택할 수 있어요." {
		t.Errorf("accept by a stranger: %q", r.err())
	}
	r = gql(t, asker.c, `mutation($p: String!, $c: String!) { acceptAnswer(PostId: $p, CommentId: $c) { Solved AcceptedCommentId } }`, map[string]interface{}{"p": p.PostId, "c": mine.CommentId})
	if r.err() != "답글은 채택할 수 없어요." {
		t.Errorf("accepting a reply: %q", r.err())
	}
	var accepted post
	gql(t, asker.c, `mutation($p: String!, $c: String!) { acceptAnswer(PostId: $p, CommentId: $c) { Solved AcceptedCommentId } }`, map[string]interface{}{"p": p.PostId, "c": a1.CommentId}).field(t, "acceptAnswer", &accepted)
	if !accepted.Solved || accepted.AcceptedCommentId != a1.CommentId {
		t.Errorf("accepted = %+v", accepted)
	}
	r = gql(t, asker.c, `mutation($p: String!, $c: String!) { acceptAnswer(PostId: $p, CommentId: $c) { Solved } }`, map[string]interface{}{"p": p.PostId, "c": b1.CommentId})
	if r.err() != "이미 채택한 답변이 있어요." {
		t.Errorf("second accept: %q", r.err())
	}
	if n := notificationTypes(t, alice); count(n, "accepted") != 1 {
		t.Errorf("alice notifications = %v, want accepted", n)
	}
	if ids := listPostIds(t, map[string]interface{}{"type": "qna", "solved": true}); !contains(ids, p.PostId) {
		t.Error("solved question missing from the solved filter")
	}

	r = gql(t, alice.c, `mutation($p: String!, $c: String!) { deleteComment(PostId: $p, CommentId: $c) }`, map[string]interface{}{"p": p.PostId, "c": a1.CommentId})
	if r.err() != "채택된 답변은 삭제할 수 없어요." {
		t.Errorf("deleting the accepted answer: %q", r.err())
	}
	if r := gql(t, bob.c, `mutation($p: String!, $c: String!) { deleteComment(PostId: $p, CommentId: $c) }`, map[string]interface{}{"p": p.PostId, "c": b1.CommentId}); r.err() != "" {
		t.Errorf("deleting own comment: %s", r.err())
	}

	var thread []comment
	gql(t, newClient(), `query($p: String!) { comments(PostId: $p) { CommentId DisplayName Deleted Accepted } }`, map[string]interface{}{"p": p.PostId}).field(t, "comments", &thread)
	ids := []string{}
	for _, c := range thread {
		ids = append(ids, c.CommentId)
		if c.CommentId == a1.CommentId && !c.Accepted {
			t.Error("accepted flag missing in the thread")
		}
	}
	if contains(ids, b1.CommentId) {
		t.Error("deleted comment without replies is still listed")
	}
	if len(thread) != 4 {
		t.Errorf("thread has %d comments, want 4", len(thread))
	}
}

func TestLikesBookmarksReports(t *testing.T) {
	author := signup(t, "like-author")
	fan := signup(t, "like-fan")
	p := newPost(t, author, "free", "일상", "e2e 공감 테스트 "+runID, false)

	like := func(on bool) post {
		var got post
		gql(t, fan.c, `mutation($p: String!, $on: Boolean!) { likePost(PostId: $p, On: $on) { LikeCount Liked } }`, map[string]interface{}{"p": p.PostId, "on": on}).field(t, "likePost", &got)
		return got
	}
	like(true)
	if got := like(true); got.LikeCount != 1 || !got.Liked {
		t.Errorf("double like = %+v, want count 1", got)
	}
	if got := like(false); got.LikeCount != 0 || got.Liked {
		t.Errorf("unlike = %+v", got)
	}

	gql(t, fan.c, `mutation($p: String!) { bookmarkPost(PostId: $p, On: true) }`, map[string]interface{}{"p": p.PostId})
	var marks []post
	gql(t, fan.c, `{ myBookmarks { PostId } }`, nil).field(t, "myBookmarks", &marks)
	if len(marks) != 1 || marks[0].PostId != p.PostId {
		t.Errorf("myBookmarks = %+v", marks)
	}
	var mine []post
	gql(t, author.c, `{ myPosts { PostId IsMine } }`, nil).field(t, "myPosts", &mine)
	if len(mine) != 1 || !mine[0].IsMine {
		t.Errorf("myPosts = %+v", mine)
	}

	report := func(u *user, targetType, id string) string {
		return gql(t, u.c, `mutation($t: String!, $id: String!) { report(TargetType: $t, TargetId: $id, Reason: "스팸·광고") }`, map[string]interface{}{"t": targetType, "id": id}).err()
	}
	if err := report(author, "post", p.PostId); err != "내 글은 신고할 수 없어요." {
		t.Errorf("reporting own post: %q", err)
	}
	if err := report(fan, "post", p.PostId); err != "" {
		t.Errorf("report: %s", err)
	}
	if err := report(fan, "post", p.PostId); err != "이미 신고했어요. 운영진이 확인하고 있어요." {
		t.Errorf("second report: %q", err)
	}
	if err := report(fan, "post", "no-such-post"); err != "신고할 대상을 찾을 수 없어요." {
		t.Errorf("reporting a missing post: %q", err)
	}
	c := addComment(t, author, p.PostId, "댓글", "", false)
	if err := report(fan, "comment", p.PostId+"#"+c.CommentId); err != "" {
		t.Errorf("reporting a comment: %s", err)
	}

	var views int
	gql(t, newClient(), `mutation($p: String!) { viewPost(PostId: $p) }`, map[string]interface{}{"p": p.PostId}).field(t, "viewPost", &views)
	if views != 1 {
		t.Errorf("viewPost = %d, want 1", views)
	}
}
