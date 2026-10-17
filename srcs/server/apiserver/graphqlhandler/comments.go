package graphqlhandler

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"apiserver/throttle"

	"local.com/dynamo"
	"local.com/jwt"
	"local.com/notify"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/graphql-go/graphql"
)

const (
	CommentActive  = "active"
	CommentDeleted = "deleted"
	CommentHidden  = "hidden"
)

var (
	errCommentNotFound = errors.New("댓글을 찾을 수 없어요.")
	errTooManyComments = errors.New("댓글을 너무 빨리 달고 있어요. 잠시 후 다시 시도해주세요.")
)

var commentLimiter = throttle.New(6, time.Minute)

// newCommentId sorts by time, so one Query returns a thread in order.
func newCommentId() string {
	b := make([]byte, 4)
	rand.Read(b)
	return fmt.Sprintf("%013d-%s", nowMs(), hex.EncodeToString(b))
}

// postLink is where notifications about a post or comment open.
func postLink(postId, commentId string) string {
	link := "/community/" + postId
	if commentId != "" {
		link += "#c-" + commentId
	}
	return link
}

func getComment(postId, commentId string) (dynamo.Item, error) {
	if postId == "" || commentId == "" {
		return nil, nil
	}
	out, err := svc.GetItem(&dynamodb.GetItemInput{
		TableName: aws.String(dynamo.TableComments),
		Key:       dynamo.Item{"PostId": {S: aws.String(postId)}, "CommentId": {S: aws.String(commentId)}},
	})
	if err != nil {
		return nil, err
	}
	return out.Item, nil
}

// anonNumber gives a member a stable "익명N" inside one post: the first
// anonymous comment draws the next number from AnonSeq, later ones reuse
// it from AnonMap. if_not_exists keeps the first number if two comments
// race; the losing draw only leaves a gap.
func anonNumber(post dynamo.Item, userId string) (int, error) {
	if v := post["AnonMap"]; v != nil && v.M != nil {
		if n := v.M[userId]; n != nil && n.N != nil {
			return strconv.Atoi(*n.N)
		}
	}
	postKey := dynamo.Item{"PostId": {S: aws.String(dynamo.S(post, "PostId"))}}
	seqOut, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TablePosts),
		Key:                       postKey,
		UpdateExpression:          aws.String("ADD AnonSeq :one"),
		ExpressionAttributeValues: dynamo.Item{":one": {N: aws.String("1")}},
		ReturnValues:              aws.String(dynamodb.ReturnValueUpdatedNew),
	})
	if err != nil {
		return 0, err
	}
	seq := seqOut.Attributes["AnonSeq"]
	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TablePosts),
		Key:                       postKey,
		UpdateExpression:          aws.String("SET AnonMap.#u = if_not_exists(AnonMap.#u, :n)"),
		ExpressionAttributeNames:  map[string]*string{"#u": aws.String(userId)},
		ExpressionAttributeValues: dynamo.Item{":n": seq},
		ReturnValues:              aws.String(dynamodb.ReturnValueUpdatedNew),
	})
	if err != nil {
		return 0, err
	}
	if m := out.Attributes["AnonMap"]; m != nil && m.M != nil && m.M[userId] != nil && m.M[userId].N != nil {
		return strconv.Atoi(*m.M[userId].N)
	}
	return 0, fmt.Errorf("anon number missing for post %s", dynamo.S(post, "PostId"))
}

// commentName is the author label everyone sees. The post's author is
// marked as such; anonymous people are only numbered.
func commentName(c, post dynamo.Item, users map[string]dynamo.Item) string {
	authorId := dynamo.S(c, "AuthorId")
	if boolOf(c, "Anonymous") {
		if authorId == dynamo.S(post, "AuthorId") {
			return AnonymousName + "(글쓴이)"
		}
		return fmt.Sprintf("%s%d", AnonymousName, int(num(c, "AnonNo")))
	}
	if users[authorId] == nil {
		return DeletedMemberName
	}
	return dynamo.S(users[authorId], "UserNickname")
}

func commentView(c, post dynamo.Item, viewer string, users map[string]dynamo.Item) map[string]interface{} {
	authorId := dynamo.S(c, "AuthorId")
	anonymous := boolOf(c, "Anonymous")
	deleted := dynamo.S(c, "Status") != CommentActive
	isPostAuthor := authorId == dynamo.S(post, "AuthorId")
	view := map[string]interface{}{
		"CommentId":    dynamo.S(c, "CommentId"),
		"PostId":       dynamo.S(c, "PostId"),
		"ParentId":     dynamo.S(c, "ParentId"),
		"Body":         dynamo.S(c, "Body"),
		"DisplayName":  commentName(c, post, users),
		"Anonymous":    anonymous,
		"IsMine":       viewer != "" && viewer == authorId,
		"IsPostAuthor": isPostAuthor,
		"Deleted":      deleted,
		"Hidden":       dynamo.S(c, "Status") == CommentHidden,
		"Accepted":     dynamo.S(post, "AcceptedCommentId") == dynamo.S(c, "CommentId"),
		"CreatedAt":    num(c, "CreatedAt"),
	}
	if deleted {
		view["Body"] = ""
		view["DisplayName"] = ""
	} else if !anonymous && users[authorId] != nil {
		view["AuthorId"] = authorId
		view["AuthorImage"] = dynamo.S(users[authorId], "ProfileImage")
	}
	return view
}

// resolveComments returns a post's thread in time order. Deleted comments
// stay as placeholders only while replies hang under them.
func resolveComments(p graphql.ResolveParams) (interface{}, error) {
	viewer := jwt.UserID(p.Context)
	postId, _ := p.Args["PostId"].(string)
	post, err := visibleOfType(postId, viewer, PostTypeFree, PostTypeQna)
	if err != nil {
		return nil, internal(err)
	}
	if post == nil {
		return []interface{}{}, nil
	}
	items, err := dynamo.QueryAll(svc, &dynamodb.QueryInput{
		TableName:                 aws.String(dynamo.TableComments),
		KeyConditionExpression:    aws.String("PostId = :p"),
		ExpressionAttributeValues: dynamo.Item{":p": {S: aws.String(postId)}},
	})
	if err != nil {
		return nil, internal(err)
	}
	sort.Slice(items, func(i, j int) bool { return dynamo.S(items[i], "CommentId") < dynamo.S(items[j], "CommentId") })

	hasReplies := map[string]bool{}
	var ids []string
	for _, c := range items {
		if parent := dynamo.S(c, "ParentId"); parent != "" && dynamo.S(c, "Status") == CommentActive {
			hasReplies[parent] = true
		}
		if !boolOf(c, "Anonymous") {
			ids = append(ids, dynamo.S(c, "AuthorId"))
		}
	}
	users, err := authors(ids)
	if err != nil {
		return nil, internal(err)
	}
	out := []map[string]interface{}{}
	for _, c := range items {
		if dynamo.S(c, "Status") != CommentActive && !hasReplies[dynamo.S(c, "CommentId")] {
			continue
		}
		out = append(out, commentView(c, post, viewer, users))
	}
	return out, nil
}

func createCommentResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	parentId, _ := p.Args["ParentId"].(string)
	anonymous, _ := p.Args["Anonymous"].(bool)
	body, _ := p.Args["Body"].(string)
	body = strings.TrimSpace(body)
	if body == "" || utf8.RuneCountInString(body) > 1000 {
		return nil, errors.New("댓글은 1~1000자로 입력해주세요.")
	}

	post, err := getPost(postId)
	if err != nil {
		return nil, internal(err)
	}
	if post == nil || dynamo.S(post, "Status") != PostActive || !isCommunityType(dynamo.S(post, "Type")) {
		return nil, errPostNotFound
	}
	var parent dynamo.Item
	if parentId != "" {
		parent, err = getComment(postId, parentId)
		if err != nil {
			return nil, internal(err)
		}
		// Replies go one level deep: a reply to a reply hangs under the
		// same top-level comment.
		if parent == nil || dynamo.S(parent, "Status") != CommentActive {
			return nil, errCommentNotFound
		}
		if top := dynamo.S(parent, "ParentId"); top != "" {
			parentId = top
		}
	}
	// The post's author always speaks under the post's identity: named on
	// a named post, "익명(글쓴이)" on an anonymous one. Mixing would let a
	// named comment unmask an anonymous question.
	if userId == dynamo.S(post, "AuthorId") {
		anonymous = boolOf(post, "Anonymous")
	}
	if !commentLimiter.Allow(userId) {
		return nil, errTooManyComments
	}

	commentId := newCommentId()
	ts := nowMs()
	item := dynamo.Item{
		"PostId":    {S: aws.String(postId)},
		"CommentId": {S: aws.String(commentId)},
		"AuthorId":  {S: aws.String(userId)},
		"Body":      {S: aws.String(body)},
		"Anonymous": {BOOL: aws.Bool(anonymous)},
		"Status":    {S: aws.String(CommentActive)},
		"CreatedAt": {N: aws.String(itoa(ts))},
	}
	if parentId != "" {
		item["ParentId"] = &dynamodb.AttributeValue{S: aws.String(parentId)}
	}
	if anonymous && userId != dynamo.S(post, "AuthorId") {
		n, err := anonNumber(post, userId)
		if err != nil {
			return nil, internal(err)
		}
		item["AnonNo"] = &dynamodb.AttributeValue{N: aws.String(strconv.Itoa(n))}
	}
	if _, err := svc.PutItem(&dynamodb.PutItemInput{TableName: aws.String(dynamo.TableComments), Item: item}); err != nil {
		return nil, internal(err)
	}
	addToPost(postId, "CommentCount", 1)
	notifyComment(post, parent, userId, commentId, body)

	users, err := authors([]string{userId})
	if err != nil {
		return nil, internal(err)
	}
	return commentView(item, post, userId, users), nil
}

// notifyComment tells the post author about a comment and the parent
// comment's author about a reply. Someone who is both gets one
// notification (the reply).
func notifyComment(post, parent dynamo.Item, actor, commentId, body string) {
	n := notifier()
	postId := dynamo.S(post, "PostId")
	postAuthor := dynamo.S(post, "AuthorId")
	replyTo := ""
	if parent != nil {
		replyTo = dynamo.S(parent, "AuthorId")
		if err := n.Publish(notify.Event{
			UserId: replyTo, ActorId: actor, Type: notify.TypeReply,
			TargetType: "comment", TargetId: postId + "#" + commentId,
			Preview: body, Link: postLink(postId, commentId),
		}); err != nil {
			log.Printf("notify reply: %v", err)
		}
	}
	if postAuthor != replyTo {
		if err := n.Publish(notify.Event{
			UserId: postAuthor, ActorId: actor, Type: notify.TypeComment,
			TargetType: "post", TargetId: postId,
			Preview: body, Link: postLink(postId, commentId),
		}); err != nil {
			log.Printf("notify comment: %v", err)
		}
	}
}

// deleteCommentResolver blanks the author's comment. An accepted answer
// stays: the question's "solved" state depends on it.
func deleteCommentResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	commentId, _ := p.Args["CommentId"].(string)
	c, err := getComment(postId, commentId)
	if err != nil {
		return nil, internal(err)
	}
	if c == nil || dynamo.S(c, "Status") == CommentDeleted {
		return nil, errCommentNotFound
	}
	if dynamo.S(c, "AuthorId") != userId {
		return nil, errors.New("내 댓글만 삭제할 수 있어요.")
	}
	post, err := getPost(postId)
	if err != nil {
		return nil, internal(err)
	}
	if dynamo.S(post, "AcceptedCommentId") == commentId {
		return nil, errors.New("채택된 답변은 삭제할 수 없어요.")
	}
	if err := setCommentStatus(postId, commentId, CommentDeleted); err != nil {
		return nil, internal(err)
	}
	return true, nil
}

// setCommentStatus is shared with moderation. Only comments leaving the
// active state lower the post's CommentCount (and only once).
func setCommentStatus(postId, commentId, status string) error {
	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TableComments),
		Key:                       dynamo.Item{"PostId": {S: aws.String(postId)}, "CommentId": {S: aws.String(commentId)}},
		UpdateExpression:          aws.String("SET #s = :s"),
		ConditionExpression:       aws.String("attribute_exists(CommentId)"),
		ExpressionAttributeNames:  map[string]*string{"#s": aws.String("Status")},
		ExpressionAttributeValues: dynamo.Item{":s": {S: aws.String(status)}},
		ReturnValues:              aws.String(dynamodb.ReturnValueUpdatedOld),
	})
	if err != nil {
		return err
	}
	was := dynamo.S(out.Attributes, "Status")
	switch {
	case was == CommentActive && status != CommentActive:
		addToPost(postId, "CommentCount", -1)
	case was != CommentActive && status == CommentActive:
		addToPost(postId, "CommentCount", 1)
	}
	return nil
}

// acceptAnswerResolver lets a question's author pick one answer, once.
// It must be a top-level answer by someone else.
func acceptAnswerResolver(p graphql.ResolveParams) (interface{}, error) {
	userId, err := requireUser(p)
	if err != nil {
		return nil, err
	}
	postId, _ := p.Args["PostId"].(string)
	commentId, _ := p.Args["CommentId"].(string)
	post, err := getPost(postId)
	if err != nil {
		return nil, internal(err)
	}
	switch {
	case post == nil || dynamo.S(post, "Status") != PostActive:
		return nil, errPostNotFound
	case dynamo.S(post, "Type") != PostTypeQna:
		return nil, errors.New("질문 글에서만 답변을 채택할 수 있어요.")
	case dynamo.S(post, "AuthorId") != userId:
		return nil, errors.New("질문한 사람만 답변을 채택할 수 있어요.")
	}
	c, err := getComment(postId, commentId)
	if err != nil {
		return nil, internal(err)
	}
	switch {
	case c == nil || dynamo.S(c, "Status") != CommentActive:
		return nil, errCommentNotFound
	case dynamo.S(c, "ParentId") != "":
		return nil, errors.New("답글은 채택할 수 없어요.")
	case dynamo.S(c, "AuthorId") == userId:
		return nil, errors.New("내 답변은 채택할 수 없어요.")
	}
	out, err := svc.UpdateItem(&dynamodb.UpdateItemInput{
		TableName:                 aws.String(dynamo.TablePosts),
		Key:                       dynamo.Item{"PostId": {S: aws.String(postId)}},
		UpdateExpression:          aws.String("SET AcceptedCommentId = :c, Solved = :t"),
		ConditionExpression:       aws.String("attribute_not_exists(AcceptedCommentId)"),
		ExpressionAttributeValues: dynamo.Item{":c": {S: aws.String(commentId)}, ":t": {BOOL: aws.Bool(true)}},
		ReturnValues:              aws.String(dynamodb.ReturnValueAllNew),
	})
	if isConditionFailed(err) {
		return nil, errors.New("이미 채택한 답변이 있어요.")
	}
	if err != nil {
		return nil, internal(err)
	}
	reindexPost(out.Attributes)
	if err := notifier().Publish(notify.Event{
		UserId: dynamo.S(c, "AuthorId"), ActorId: userId, Type: notify.TypeAccepted,
		TargetType: "comment", TargetId: postId + "#" + commentId,
		Preview: dynamo.S(post, "Title"), Link: postLink(postId, commentId),
	}); err != nil {
		log.Printf("notify accepted: %v", err)
	}
	views, err := postViews([]dynamo.Item{out.Attributes}, userId)
	if err != nil {
		return nil, internal(err)
	}
	return views[0], nil
}
