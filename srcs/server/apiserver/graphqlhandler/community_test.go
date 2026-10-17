package graphqlhandler

import (
	"strings"
	"testing"

	"local.com/dynamo"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
)

func TestParsePostInput(t *testing.T) {
	ok := map[string]interface{}{"Type": "qna", "Topic": "체류증·비자", "Title": "  체류증   갱신  ", "Body": "질문"}
	in, err := parsePostInput(ok)
	if err != nil {
		t.Fatal(err)
	}
	if in.Title != "체류증 갱신" || in.City != DefaultRegion {
		t.Errorf("normalized = %+v", in)
	}

	bad := []map[string]interface{}{
		{"Type": "housing", "Topic": "체류증·비자", "Title": "제목입니다", "Body": "x"},
		{"Type": "qna", "Topic": "일상", "Title": "제목입니다", "Body": "x"},
		{"Type": "free", "Topic": "일상", "Title": "가", "Body": "x"},
		{"Type": "free", "Topic": "일상", "Title": "제목입니다", "Body": "   "},
		{"Type": "free", "Topic": "일상", "Title": "제목입니다", "Body": strings.Repeat("가", 5001)},
		{"Type": "free", "Topic": "일상", "Title": "제목입니다", "Body": "x", "City": "서울"},
		{"Type": "free", "Topic": "일상", "Title": "제목입니다", "Body": "x", "Images": []interface{}{"https://evil.example/a.jpg"}},
	}
	for i, args := range bad {
		if _, err := parsePostInput(args); err == nil {
			t.Errorf("case %d accepted: %v", i, args)
		}
	}
}

func post(anonymous bool) dynamo.Item {
	return dynamo.Item{
		"PostId":    {S: aws.String("p1")},
		"Type":      {S: aws.String("qna")},
		"AuthorId":  {S: aws.String("author")},
		"Anonymous": {BOOL: aws.Bool(anonymous)},
		"Title":     {S: aws.String("질문")},
		"Body":      {S: aws.String("내용")},
		"Status":    {S: aws.String(PostActive)},
	}
}

func TestPostViewHidesAnonymousAuthor(t *testing.T) {
	users := map[string]dynamo.Item{"author": {"UserNickname": {S: aws.String("냥이")}}}

	v := postView(post(true), "someone", users)
	if _, leaked := v["AuthorId"]; leaked || v["AuthorNickname"] != AnonymousName || v["IsMine"] != false {
		t.Errorf("anonymous view = %v", v)
	}
	if v := postView(post(true), "author", users); v["IsMine"] != true {
		t.Error("the author must still see IsMine")
	}
	if v := postView(post(false), "", users); v["AuthorId"] != "author" || v["AuthorNickname"] != "냥이" {
		t.Errorf("named view = %v", v)
	}
	if v := postView(post(false), "", map[string]dynamo.Item{}); v["AuthorNickname"] != DeletedMemberName {
		t.Errorf("deleted author = %v", v["AuthorNickname"])
	}
}

func comment(author string, anonymous bool, anonNo string) dynamo.Item {
	c := dynamo.Item{
		"PostId":    {S: aws.String("p1")},
		"CommentId": {S: aws.String("c1")},
		"AuthorId":  {S: aws.String(author)},
		"Anonymous": {BOOL: aws.Bool(anonymous)},
		"Status":    {S: aws.String(CommentActive)},
		"Body":      {S: aws.String("답")},
	}
	if anonNo != "" {
		c["AnonNo"] = &dynamodb.AttributeValue{N: aws.String(anonNo)}
	}
	return c
}

func TestCommentLabels(t *testing.T) {
	users := map[string]dynamo.Item{"bob": {"UserNickname": {S: aws.String("밥")}}, "author": {"UserNickname": {S: aws.String("냥이")}}}
	cases := []struct {
		c    dynamo.Item
		p    dynamo.Item
		want string
	}{
		{comment("bob", false, ""), post(false), "밥"},
		{comment("bob", true, "2"), post(false), "익명2"},
		{comment("author", true, ""), post(true), "익명(글쓴이)"},
		{comment("gone", false, ""), post(false), DeletedMemberName},
	}
	for _, c := range cases {
		if got := commentName(c.c, c.p, users); got != c.want {
			t.Errorf("label = %q, want %q", got, c.want)
		}
	}

	v := commentView(comment("bob", true, "1"), post(false), "", users)
	if _, leaked := v["AuthorId"]; leaked {
		t.Error("anonymous comment leaks its author id")
	}
	deleted := comment("bob", false, "")
	deleted["Status"] = &dynamodb.AttributeValue{S: aws.String(CommentDeleted)}
	if v := commentView(deleted, post(false), "", users); v["Body"] != "" || v["DisplayName"] != "" || v["Deleted"] != true {
		t.Errorf("deleted comment view = %v", v)
	}
}

func TestReportIdIsPerReporter(t *testing.T) {
	a, b := reportId("post", "p1", "u1"), reportId("post", "p1", "u2")
	if a == b || a != reportId("post", "p1", "u1") {
		t.Error("report ids must be stable per (target, reporter) and differ between reporters")
	}
}
